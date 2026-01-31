#version 300 es

precision highp float;

// Varyings
in vec3 v_normal;
in vec3 v_worldPos;

// Uniforms
uniform vec3 u_lightDir;
uniform vec3 u_cameraPos;
uniform vec3 u_tileColor;
uniform float u_selected;    // 0.0 or 1.0
uniform float u_hovered;     // 0.0 or 1.0
uniform float u_time;
uniform float u_isHQ;        // 0.0 or 1.0 - Headquarters distinction
uniform vec3 u_playerColor;  // Player ownership color tint
uniform float u_hasOwner;    // 0.0 = no owner (valid placement), 1.0 = has owner

// Trinity Formation Animation Uniforms
uniform float u_trinityPhase;        // 0=none, 1=glow, 2=dissolve, 3=form
uniform float u_phaseProgress;       // 0.0-1.0 within current phase
uniform float u_borderGlowIntensity; // Border glow strength
uniform float u_dissolveThreshold;   // Dissolve progress (0=solid, 1=fully dissolved)
uniform float u_isFormingTrinity;    // 0.0 or 1.0 - is this tile part of formation
uniform float u_formationProgress;   // Materialization progress for forming Trinity

// Opacity control for preview tiles
uniform float u_opacity;             // 0.0-1.0, multiplier for final alpha (default 1.0)

// Output
out vec4 fragColor;

// ============================================================================
// NOISE FUNCTIONS (for milky texture)
// ============================================================================

// Simple hash function for pseudo-random values
float hash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

// 3D noise function
float noise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f); // smoothstep

  return mix(
    mix(mix(hash(i + vec3(0,0,0)), hash(i + vec3(1,0,0)), f.x),
        mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
    mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
        mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z
  );
}

// Fractal Brownian Motion for more natural noise
float fbm(vec3 p) {
  float value = 0.0;
  float amplitude = 0.5;
  for (int i = 0; i < 3; i++) {
    value += amplitude * noise(p);
    p *= 2.0;
    amplitude *= 0.5;
  }
  return value;
}

// ============================================================================
// FRESNEL EFFECT
// ============================================================================

// Schlick's approximation for Fresnel
float fresnel(vec3 viewDir, vec3 normal, float F0) {
  float cosTheta = max(dot(viewDir, normal), 0.0);
  return F0 + (1.0 - F0) * pow(1.0 - cosTheta, 5.0);
}

// ============================================================================
// REFRACTION EFFECT
// ============================================================================

// Index of refraction for glass-like material
const float IOR = 1.45;

// Calculate refraction direction
vec3 refract_custom(vec3 incident, vec3 normal, float eta) {
  float cosI = -dot(normal, incident);
  float sinT2 = eta * eta * (1.0 - cosI * cosI);
  if (sinT2 > 1.0) return reflect(incident, normal); // Total internal reflection
  float cosT = sqrt(1.0 - sinT2);
  return eta * incident + (eta * cosI - cosT) * normal;
}

// Internal caustics pattern (light focusing inside glass)
float caustics(vec3 pos, float time) {
  vec3 p = pos * 6.0;
  float c = 0.0;

  // Multiple overlapping wave patterns
  c += sin(p.x * 2.3 + time * 0.7) * cos(p.z * 2.1 + time * 0.5) * 0.3;
  c += sin(p.x * 3.7 - time * 0.4) * cos(p.z * 3.3 + time * 0.6) * 0.2;
  c += sin(p.y * 4.1 + time * 0.3) * cos(p.x * 4.5 - time * 0.4) * 0.15;

  return c * 0.5 + 0.5; // Normalize to 0-1
}

// Chromatic aberration (color dispersion through glass)
vec3 chromaticAberration(vec3 viewDir, vec3 normal, vec3 baseColor, float strength) {
  // Different IOR for each color channel
  vec3 refractR = refract_custom(-viewDir, normal, 1.0 / (IOR - 0.02));
  vec3 refractG = refract_custom(-viewDir, normal, 1.0 / IOR);
  vec3 refractB = refract_custom(-viewDir, normal, 1.0 / (IOR + 0.02));

  // Sample "environment" based on refracted directions
  // Using world position + refraction as a simple environment lookup
  float dispersionR = dot(refractR, vec3(0.5, 0.3, 0.4)) * 0.5 + 0.5;
  float dispersionG = dot(refractG, vec3(0.5, 0.3, 0.4)) * 0.5 + 0.5;
  float dispersionB = dot(refractB, vec3(0.5, 0.3, 0.4)) * 0.5 + 0.5;

  vec3 dispersion = vec3(dispersionR, dispersionG, dispersionB);
  return mix(baseColor, baseColor * dispersion, strength);
}

// ============================================================================
// SUBSURFACE SCATTERING APPROXIMATION
// ============================================================================

// Simplified SSS - light wraps around the object
vec3 subsurfaceScattering(vec3 lightDir, vec3 viewDir, vec3 normal, vec3 baseColor) {
  // Light that passes through the material
  float scatterWidth = 0.5; // How much light wraps around
  float scatterFalloff = 2.0;

  // Calculate wrap lighting (light from behind)
  float NdotL = dot(normal, lightDir);
  float wrap = (NdotL + scatterWidth) / (1.0 + scatterWidth);
  wrap = max(wrap, 0.0);

  // View-dependent scattering (light coming toward viewer through material)
  vec3 scatterDir = lightDir + normal * 0.5;
  float VdotS = pow(max(dot(viewDir, -scatterDir), 0.0), scatterFalloff);

  // Subsurface color (warmer, more saturated)
  vec3 scatterColor = baseColor * 1.2 + vec3(0.1, 0.05, 0.0);

  // Combine wrapped lighting with forward scattering
  float scatter = wrap * 0.3 + VdotS * 0.4;

  return scatterColor * scatter;
}

// ============================================================================
// TRINITY FORMATION EFFECTS
// ============================================================================

// Border glow using fresnel edge detection
float getTrinityBorderIntensity(vec3 viewDir, vec3 normal) {
  float fresnel = 1.0 - max(dot(viewDir, normal), 0.0);
  // Emphasize the edge more strongly
  return smoothstep(0.3, 0.85, fresnel);
}

// Noise-based dissolve alpha - returns 1.0 where visible, 0.0 where dissolved
float getDissolveAlpha(vec3 worldPos, float threshold) {
  // Use fbm for organic dissolve pattern with time-based animation
  float noiseVal = fbm(worldPos * 4.0 + vec3(0.0, u_time * 0.3, 0.0));
  // Smooth transition at dissolve edge
  return smoothstep(threshold - 0.1, threshold + 0.05, noiseVal);
}

// Hot emission at dissolve edge (white-to-orange glow)
vec3 getDissolveEdgeEmission(vec3 worldPos, float threshold) {
  float noiseVal = fbm(worldPos * 4.0 + vec3(0.0, u_time * 0.3, 0.0));

  // Narrow band at dissolve edge for hot glow
  float edge = smoothstep(threshold - 0.15, threshold - 0.03, noiseVal) *
               (1.0 - smoothstep(threshold + 0.02, threshold + 0.12, noiseVal));

  // Hot white-to-orange gradient at the burning edge
  vec3 hotColorInner = vec3(1.0, 1.0, 0.9);  // White hot core
  vec3 hotColorOuter = vec3(1.0, 0.5, 0.1);  // Orange outer
  vec3 hotColor = mix(hotColorInner, hotColorOuter, smoothstep(0.0, 1.0, edge));

  return hotColor * edge * 4.0; // High intensity for bloom-like effect
}

// Reverse dissolve for materialization (Trinity block appearing)
float getMaterializeAlpha(vec3 worldPos, float progress) {
  float noiseVal = fbm(worldPos * 4.0);
  // Reverse: high progress = more visible
  // progress 0 = nothing visible, progress 1 = fully visible
  float threshold = 1.0 - progress;
  return smoothstep(threshold - 0.1, threshold + 0.05, noiseVal);
}

// Player-colored luminescence for the formed Trinity block
vec3 getTrinityLuminescence(vec3 playerColor, float progress, vec3 viewDir, vec3 normal) {
  // Pulsing glow
  float pulse = 0.7 + 0.3 * sin(u_time * 4.0);

  // Rim-based glow (stronger at edges)
  float rim = 1.0 - max(dot(viewDir, normal), 0.0);
  rim = smoothstep(0.2, 0.9, rim);

  // Mix player color with white for luminescent quality
  vec3 luminance = mix(playerColor, vec3(1.0), 0.35) * pulse;

  // Core glow + edge glow
  float coreGlow = 0.15 * progress;
  float edgeGlow = rim * 0.6 * progress;

  return luminance * (coreGlow + edgeGlow);
}

// ============================================================================
// MAIN
// ============================================================================

void main() {
  vec3 normal = normalize(v_normal);
  vec3 viewDir = normalize(u_cameraPos - v_worldPos);
  vec3 lightDir = normalize(u_lightDir);

  // Base color with slight variation from noise
  vec3 noisePos = v_worldPos * 8.0;
  float surfaceNoise = fbm(noisePos) * 0.15;
  vec3 baseColor = u_tileColor * (0.9 + surfaceNoise);

  // ========================================
  // HOVER EFFECT
  // ========================================
  if (u_hovered > 0.5) {
    float pulse = 0.5 + 0.5 * sin(u_time * 3.0);
    baseColor = mix(baseColor, vec3(1.0), 0.15 + 0.1 * pulse);
    // Add inner glow
    float innerGlow = 1.0 - max(dot(viewDir, normal), 0.0);
    baseColor += vec3(0.2, 0.2, 0.3) * innerGlow * pulse * 0.5;
  }

  // ========================================
  // SELECTION EFFECT
  // ========================================
  if (u_selected > 0.5) {
    float selectionPulse = 0.5 + 0.5 * sin(u_time * 4.0);
    baseColor = mix(baseColor, vec3(1.0, 1.0, 0.7), 0.25 + 0.1 * selectionPulse);
  }

  // ========================================
  // HQ (HEADQUARTERS) DISTINCTION EFFECT
  // ========================================
  if (u_isHQ > 0.5) {
    // Golden/amber pulsing glow for HQ tiles
    float hqPulse = 0.6 + 0.4 * sin(u_time * 2.5);
    vec3 hqGlow = vec3(1.0, 0.8, 0.3); // Golden color

    // Add a warm tint to the base color
    baseColor = mix(baseColor, baseColor * hqGlow, 0.3);

    // Add rim glow effect for HQ
    float hqRim = 1.0 - max(dot(viewDir, normal), 0.0);
    hqRim = smoothstep(0.3, 0.9, hqRim);
    baseColor += hqGlow * hqRim * hqPulse * 0.5;

    // Add inner glow
    baseColor += hqGlow * 0.15 * hqPulse;
  }

  // ========================================
  // PLAYER OWNERSHIP COLOR (edge tint)
  // ========================================
  if (u_hasOwner > 0.5) {
    // Calculate rim factor for edge coloring
    float ownerRim = 1.0 - max(dot(viewDir, normal), 0.0);
    ownerRim = smoothstep(0.2, 0.8, ownerRim);

    // Subtle base tint to the entire tile
    baseColor = mix(baseColor, baseColor * (0.85 + u_playerColor * 0.25), 0.3);

    // Stronger player color on edges (rim)
    vec3 playerRimColor = u_playerColor * 0.8 + vec3(0.2);
    baseColor += playerRimColor * ownerRim * 0.35;

    // Add subtle colored inner glow
    float innerGlow = pow(1.0 - ownerRim, 2.0);
    baseColor += u_playerColor * innerGlow * 0.08;
  }

  // ========================================
  // FRESNEL (edge transparency/glow)
  // ========================================
  float F0 = 0.04; // Dielectric Fresnel reflectance
  float fresnelTerm = fresnel(viewDir, normal, F0);

  // ========================================
  // LIGHTING
  // ========================================

  // Ambient (slightly blue for cool shadows)
  vec3 ambientColor = vec3(0.35, 0.38, 0.45);
  vec3 ambient = ambientColor * baseColor;

  // Diffuse with soft edge
  float NdotL = max(dot(normal, lightDir), 0.0);
  float softDiffuse = smoothstep(-0.1, 1.0, NdotL);
  vec3 diffuse = baseColor * softDiffuse * 0.5;

  // Specular (glossy reflection)
  vec3 halfDir = normalize(lightDir + viewDir);
  float NdotH = max(dot(normal, halfDir), 0.0);
  float specPower = 64.0;
  float specular = pow(NdotH, specPower) * 0.6;
  vec3 specularColor = vec3(1.0) * specular;

  // ========================================
  // SUBSURFACE SCATTERING
  // ========================================
  vec3 sss = subsurfaceScattering(lightDir, viewDir, normal, baseColor);

  // ========================================
  // REFRACTION & CAUSTICS
  // ========================================
  // Internal caustics (light patterns inside glass)
  float causticsPattern = caustics(v_worldPos, u_time);
  vec3 causticsColor = baseColor * (1.0 + causticsPattern * 0.15);

  // Chromatic aberration (color dispersion)
  vec3 refractedColor = chromaticAberration(viewDir, normal, causticsColor, 0.08);

  // Blend refraction into base color based on view angle
  float refractionBlend = 1.0 - abs(dot(viewDir, normal));
  refractionBlend = smoothstep(0.0, 0.6, refractionBlend) * 0.25;
  baseColor = mix(baseColor, refractedColor, refractionBlend);

  // ========================================
  // RIM LIGHTING (backlight glow)
  // ========================================
  float rim = 1.0 - max(dot(viewDir, normal), 0.0);
  rim = smoothstep(0.4, 1.0, rim);
  vec3 rimColor = baseColor * 0.5 + vec3(0.2, 0.2, 0.3);
  vec3 rimLight = rimColor * rim * 0.4;

  // ========================================
  // COMBINE ALL EFFECTS
  // ========================================
  vec3 finalColor = ambient + diffuse + specularColor + sss + rimLight;

  // Add Fresnel reflection (environment reflection approximation)
  vec3 envColor = vec3(0.8, 0.85, 0.9); // Sky-like environment color
  finalColor = mix(finalColor, envColor, fresnelTerm * 0.3);

  // ========================================
  // TRANSPARENCY (milky glass effect)
  // ========================================
  // Base transparency
  float baseAlpha = 0.92;

  // More transparent at edges (Fresnel-based)
  float edgeTransparency = fresnelTerm * 0.15;

  // Slight noise variation in transparency
  float alphaVariation = surfaceNoise * 0.05;

  float alpha = baseAlpha - edgeTransparency + alphaVariation;
  alpha = clamp(alpha, 0.75, 0.98);

  // Brighter tiles should be slightly more opaque
  float brightness = dot(finalColor, vec3(0.299, 0.587, 0.114));
  alpha = mix(alpha, min(alpha + 0.05, 1.0), brightness * 0.3);

  // ========================================
  // TRINITY FORMATION ANIMATION
  // ========================================
  if (u_isFormingTrinity > 0.5) {

    // Phase 1: Border Glow (white with bloom approximation)
    if (u_trinityPhase > 0.5 && u_trinityPhase < 1.5) {
      float borderIntensity = getTrinityBorderIntensity(viewDir, normal);
      // White glow with subtle blue energy tint
      vec3 glowColor = mix(vec3(1.0), vec3(0.85, 0.92, 1.0), 0.25);

      // Additive bloom approximation - multiple layers
      float glowStrength = borderIntensity * u_borderGlowIntensity;
      finalColor += glowColor * glowStrength * 2.5;
      finalColor += glowColor * glowStrength * 0.8 * (1.0 - borderIntensity); // Spread

      // Pulse the whole tile slightly brighter
      float pulse = 0.5 + 0.5 * sin(u_time * 6.0);
      finalColor += vec3(0.15) * pulse * u_borderGlowIntensity;
    }

    // Phase 2: Disintegration
    if (u_trinityPhase > 1.5 && u_trinityPhase < 2.5) {
      // Add hot edge emission at dissolve boundary
      vec3 edgeEmission = getDissolveEdgeEmission(v_worldPos, u_dissolveThreshold);
      finalColor += edgeEmission;

      // Apply dissolve to alpha
      float dissolveAlpha = getDissolveAlpha(v_worldPos, u_dissolveThreshold);
      alpha *= dissolveAlpha;

      // Early discard for performance on fully dissolved pixels
      if (alpha < 0.01) discard;
    }

    // Phase 3: Formation/Materialization
    if (u_trinityPhase > 2.5) {
      // Add luminescent glow in player color
      vec3 luminescence = getTrinityLuminescence(u_playerColor, u_formationProgress, viewDir, normal);
      finalColor += luminescence;

      // Apply materialization alpha (reverse dissolve)
      float materializeAlpha = getMaterializeAlpha(v_worldPos, u_formationProgress);
      alpha *= materializeAlpha;

      // Bright edge at materialization front
      float matEdge = smoothstep(0.0, 0.15, materializeAlpha) * (1.0 - smoothstep(0.15, 0.4, materializeAlpha));
      finalColor += vec3(1.0, 0.95, 0.9) * matEdge * 2.0;

      // Discard not-yet-materialized pixels
      if (alpha < 0.01) discard;
    }
  }

  // Apply opacity for preview tiles on invalid positions
  // When u_opacity < 1.0, use it directly as final alpha (not multiplied)
  // This ensures exactly 15% transparency (0.85 alpha) for invalid placements
  if (u_opacity < 1.0) {
    alpha = u_opacity;
  }

  fragColor = vec4(finalColor, alpha);
}
