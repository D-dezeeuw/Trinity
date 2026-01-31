#version 300 es

precision highp float;

// Varyings
in vec3 v_position;
in vec3 v_normal;
in vec2 v_uv;
in vec3 v_worldPos;

// Uniforms
uniform vec3 u_lightDir;
uniform vec3 u_cameraPos;
uniform float u_time;
uniform vec2 u_hoveredTile;  // -1, -1 if no tile hovered
uniform float u_tileSize;
uniform int u_boardSize;
uniform vec2 u_validPlacements[64];  // Array of valid placement positions
uniform int u_validPlacementCount;
uniform vec2 u_landmarkPreview[3];   // Tiles that would form a landmark
uniform int u_landmarkPreviewCount;

// Output
out vec4 fragColor;

// Constants
const vec3 COLOR_LIGHT = vec3(0.95, 0.95, 0.97);
const vec3 COLOR_DARK = vec3(0.85, 0.85, 0.88);
const vec3 COLOR_GRID = vec3(0.7, 0.7, 0.75);
const vec3 COLOR_HOVER = vec3(0.6, 0.8, 1.0);
const vec3 COLOR_VALID = vec3(0.4, 1.0, 0.6);  // Green for valid placements
const vec3 COLOR_LANDMARK = vec3(1.0, 0.85, 0.3);  // Gold for landmark preview
const float GRID_WIDTH = 0.025;  // Thinner, sharper grid lines

// Player edge colors (more saturated for visibility)
const vec3 COLOR_PLAYER1 = vec3(0.1, 0.5, 1.0);   // Bright blue for Player 1
const vec3 COLOR_PLAYER2 = vec3(1.0, 0.25, 0.2);  // Bright red for Player 2
const float EDGE_BORDER_WIDTH = 0.25;  // Width of edge border as fraction of tile (was 0.15)

// Glare/shimmer effect
const float GLARE_INTENSITY = 0.10;       // Overall glare strength
const float NORMAL_PERTURBATION = 0.04;   // How much checkered pattern affects normals

// Shimmer/grain settings
const float GRAIN_SCALE = 40.0;           // Scale of surface grain (lower = larger features)
const float GRAIN_INTENSITY = 0.12;       // How visible the static grain is
const float SHIMMER_INTENSITY = 0.08;     // How much the grain animates
const float SHIMMER_SPEED = 1.5;          // Animation speed
const float NOISE_NORMAL_STRENGTH = 0.15; // How much noise affects surface normals

// ============================================================================
// Hash-based Noise - Fast pseudo-random for visible grain
// ============================================================================

// Fast hash function for pseudo-random values
float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

// 2D value noise with interpolation
float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);

  // Smooth interpolation curve
  vec2 u = f * f * (3.0 - 2.0 * f);

  // Sample corners
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));

  // Bilinear interpolation
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

// Layered noise for richer texture
float layeredNoise(vec2 p, float time) {
  float n = 0.0;

  // Base grain layer (static)
  n += valueNoise(p) * 0.5;

  // Second octave (finer detail)
  n += valueNoise(p * 2.0 + 0.5) * 0.25;

  // Animated shimmer layer (slower, larger scale)
  vec2 shimmerOffset = vec2(time * 0.3, time * 0.2);
  n += valueNoise(p * 0.5 + shimmerOffset) * 0.25;

  return n;
}

/**
 * Get surface grain and shimmer
 * Creates visible texture that subtly animates
 */
float getSurfaceGrain(vec3 worldPos, float time, float checker) {
  vec2 uv = worldPos.xz * GRAIN_SCALE;

  // Get layered noise value
  float noise = layeredNoise(uv, time * SHIMMER_SPEED);

  // Remap to centered range (-0.5 to 0.5)
  noise = noise - 0.5;

  // Checker tiles get slightly different grain phase
  if (checker > 0.5) {
    noise *= -1.0;  // Invert for alternating tiles
  }

  // Add traveling wave for shimmer movement
  float wave = sin(worldPos.x * 3.0 + worldPos.z * 2.0 + time * SHIMMER_SPEED);
  wave *= 0.3;

  // Combine static grain with animated shimmer
  float result = noise * GRAIN_INTENSITY + noise * wave * SHIMMER_INTENSITY;

  return result;
}

/**
 * Compute normal perturbation from noise gradient
 * Samples noise at offset positions to approximate surface slope
 */
vec3 getNoiseNormal(vec3 worldPos, float time) {
  vec2 uv = worldPos.xz * GRAIN_SCALE;
  float eps = 0.5;  // Sample offset for gradient calculation

  // Sample noise at 3 points to compute gradient
  float center = layeredNoise(uv, time * SHIMMER_SPEED);
  float dx = layeredNoise(uv + vec2(eps, 0.0), time * SHIMMER_SPEED);
  float dz = layeredNoise(uv + vec2(0.0, eps), time * SHIMMER_SPEED);

  // Compute gradient (derivative approximation)
  float gradX = (dx - center) / eps;
  float gradZ = (dz - center) / eps;

  // Create normal from gradient (negative because higher noise = bump up)
  vec3 perturbation = vec3(-gradX, 0.0, -gradZ) * NOISE_NORMAL_STRENGTH;

  return normalize(vec3(perturbation.x, 1.0, perturbation.z));
}

// ============================================================================
// Board Functions
// ============================================================================

// Get tile coordinates from world position
vec2 getTileCoords(vec3 worldPos) {
  float halfBoard = float(u_boardSize) * u_tileSize * 0.5;
  vec2 boardPos = worldPos.xz + halfBoard;
  return floor(boardPos / u_tileSize);
}

// Check if position is on grid line (sharp edges)
float getGridLine(vec3 worldPos) {
  float halfBoard = float(u_boardSize) * u_tileSize * 0.5;
  vec2 boardPos = worldPos.xz + halfBoard;
  vec2 tilePos = mod(boardPos, u_tileSize);

  // Sharper transitions with tighter smoothstep range
  float edge = GRID_WIDTH * 0.3;  // Transition zone
  float lineX = smoothstep(0.0, edge, tilePos.x - GRID_WIDTH) *
                smoothstep(0.0, edge, (u_tileSize - tilePos.x) - GRID_WIDTH);
  float lineY = smoothstep(0.0, edge, tilePos.y - GRID_WIDTH) *
                smoothstep(0.0, edge, (u_tileSize - tilePos.y) - GRID_WIDTH);

  return 1.0 - min(lineX, lineY);
}

// Smooth hover effect
float getHoverIntensity(vec2 tileCoords) {
  if (u_hoveredTile.x < 0.0) return 0.0;

  vec2 diff = tileCoords - u_hoveredTile;
  float dist = length(diff);

  // Pulsing glow
  float pulse = 0.5 + 0.5 * sin(u_time * 3.0);
  float intensity = smoothstep(1.5, 0.0, dist) * (0.7 + 0.3 * pulse);

  return intensity;
}

// Check if tile is a valid placement
float getValidPlacementIntensity(vec2 tileCoords) {
  if (u_validPlacementCount <= 0) return 0.0;

  for (int i = 0; i < 64; i++) {
    if (i >= u_validPlacementCount) break;

    vec2 validPos = u_validPlacements[i];
    if (validPos.x < 0.0) continue;

    if (abs(tileCoords.x - validPos.x) < 0.5 && abs(tileCoords.y - validPos.y) < 0.5) {
      // Gentle pulsing glow
      float pulse = 0.5 + 0.5 * sin(u_time * 2.0 + validPos.x * 0.5 + validPos.y * 0.7);
      return 0.3 + 0.2 * pulse;
    }
  }

  return 0.0;
}

// Check if tile would be part of a landmark formation
float getLandmarkPreviewIntensity(vec2 tileCoords) {
  if (u_landmarkPreviewCount <= 0) return 0.0;

  for (int i = 0; i < 3; i++) {
    if (i >= u_landmarkPreviewCount) break;

    vec2 landmarkPos = u_landmarkPreview[i];
    if (landmarkPos.x < 0.0) continue;

    if (abs(tileCoords.x - landmarkPos.x) < 0.5 && abs(tileCoords.y - landmarkPos.y) < 0.5) {
      // Golden pulsing glow for landmark tiles
      float pulse = 0.6 + 0.4 * sin(u_time * 4.0 + float(i) * 2.1);
      return 0.5 + 0.3 * pulse;
    }
  }

  return 0.0;
}

// Get player edge border color and intensity
// Returns: vec4(r, g, b, intensity)
vec4 getPlayerEdgeBorder(vec3 worldPos) {
  float halfBoard = float(u_boardSize) * u_tileSize * 0.5;
  float borderSize = u_tileSize * EDGE_BORDER_WIDTH;

  // Add outer glow zone extending beyond core border
  float glowSize = borderSize * 1.5;

  // Check Player 1 edge (negative Z / near side / y=0 in tile coords)
  float distToP1Edge = worldPos.z + halfBoard;  // Distance from near edge
  if (distToP1Edge < glowSize && distToP1Edge >= 0.0) {
    float intensity;
    if (distToP1Edge < borderSize) {
      // Core border: strong effect
      intensity = 1.0 - (distToP1Edge / borderSize);
      intensity = pow(intensity, 1.5);  // Smoother falloff
    } else {
      // Outer glow zone: softer falloff
      float glowDist = distToP1Edge - borderSize;
      float glowRange = glowSize - borderSize;
      intensity = (1.0 - glowDist / glowRange) * 0.3;
    }

    // Enhanced pulsing
    float pulse = 0.8 + 0.2 * sin(u_time * 2.0);

    return vec4(COLOR_PLAYER1, intensity * pulse);  // No 0.7 multiplier
  }

  // Check Player 2 edge (positive Z / far side / y=boardSize-1 in tile coords)
  float distToP2Edge = halfBoard - worldPos.z;  // Distance from far edge
  if (distToP2Edge < glowSize && distToP2Edge >= 0.0) {
    float intensity;
    if (distToP2Edge < borderSize) {
      // Core border: strong effect
      intensity = 1.0 - (distToP2Edge / borderSize);
      intensity = pow(intensity, 1.5);  // Smoother falloff
    } else {
      // Outer glow zone: softer falloff
      float glowDist = distToP2Edge - borderSize;
      float glowRange = glowSize - borderSize;
      intensity = (1.0 - glowDist / glowRange) * 0.3;
    }

    // Enhanced pulsing (offset phase)
    float pulse = 0.8 + 0.2 * sin(u_time * 2.0 + 3.14159);

    return vec4(COLOR_PLAYER2, intensity * pulse);  // No 0.7 multiplier
  }

  return vec4(0.0);
}

/**
 * Generate perturbed normal based on checkered pattern AND noise
 * Combines tile convexity with noise-based surface texture for glare
 */
vec3 getPerturbedNormal(vec2 tileCoords, float checker, vec3 worldPos, float time) {
  // Calculate distance to nearest tile edge (0 at edge, 0.5 at center)
  vec2 tileLocal = fract(tileCoords);
  vec2 edgeDist = min(tileLocal, 1.0 - tileLocal);
  float edgeFactor = min(edgeDist.x, edgeDist.y);

  // Create subtle normal tilt based on position within tile
  // Tiles appear slightly convex (higher in center)
  vec2 tileCenter = tileLocal - 0.5;
  vec3 checkerPerturbation = vec3(
    tileCenter.x * NORMAL_PERTURBATION,
    0.0,
    tileCenter.y * NORMAL_PERTURBATION
  );

  // Alternate perturbation direction based on checker pattern
  float checkerSign = checker > 0.5 ? 1.0 : -1.0;
  checkerPerturbation.xz *= checkerSign;

  // Stronger perturbation near edges
  float edgeBoost = 1.0 + (1.0 - smoothstep(0.0, 0.15, edgeFactor)) * 0.5;
  checkerPerturbation *= edgeBoost;

  // Get noise-based normal perturbation
  vec3 noiseNormal = getNoiseNormal(worldPos, time);

  // Extract the perturbation component from noise normal (subtract base up vector)
  vec3 noisePerturbation = noiseNormal - vec3(0.0, 1.0, 0.0);

  // Combine checker and noise perturbations
  vec3 combinedPerturbation = checkerPerturbation + noisePerturbation;

  // Return normalized combined normal
  return normalize(vec3(combinedPerturbation.x, 1.0, combinedPerturbation.z));
}

/**
 * Calculate camera-reactive glare with parallel streaks
 */
float calculateGlare(vec3 worldPos, vec3 perturbedNormal) {
  // View direction from fragment to camera
  vec3 viewDir = normalize(u_cameraPos - worldPos);

  // Get camera position for streak calculations
  vec2 cameraXZ = u_cameraPos.xz;
  float cameraHeight = u_cameraPos.y;

  // Calculate angle of camera around the board (yaw/rotation)
  float cameraAngle = atan(cameraXZ.x, cameraXZ.y);

  // Calculate camera pitch (tilt) - how much camera looks down
  float cameraDist = length(cameraXZ);
  float cameraPitch = atan(cameraHeight, cameraDist);

  // Streak direction rotates with camera angle
  vec2 streakDir = vec2(cos(cameraAngle + 0.785), sin(cameraAngle + 0.785));

  // Project world position onto streak direction
  float streakPos = dot(worldPos.xz, streakDir);

  // Offset based on camera angle AND pitch for reactive movement
  float cameraOffset = cameraAngle * 2.5 + cameraPitch * 3.0;
  streakPos += cameraOffset;

  // Single streak pattern
  float streakPattern = sin(streakPos * 1.8);
  streakPattern = smoothstep(0.25, 0.75, streakPattern);

  // Reflection intensity varies with view angle
  vec3 reflectDir = reflect(-viewDir, perturbedNormal);
  vec3 glareLight = normalize(u_lightDir);
  float reflectIntensity = max(dot(reflectDir, glareLight), 0.0);
  reflectIntensity = pow(reflectIntensity, 4.0);

  // Pitch-based intensity (tilting board changes glare strength)
  float pitchBoost = 0.8 + 0.4 * sin(cameraPitch * 2.0);

  // Combine factors
  float glare = streakPattern * (0.4 + reflectIntensity * 0.6);
  glare *= pitchBoost;

  // Grazing angle effect
  float grazing = 1.0 - abs(dot(viewDir, vec3(0.0, 1.0, 0.0)));
  grazing = pow(grazing, 2.0) * 0.3;

  return glare * GLARE_INTENSITY + grazing * 0.05;
}

void main() {
  vec3 normal = normalize(v_normal);
  vec3 lightDir = normalize(u_lightDir);
  vec3 viewDir = normalize(u_cameraPos - v_worldPos);

  // Detect which face we're rendering based on normal direction
  bool isTopFace = normal.y > 0.9;
  bool isFrontFace = normal.z < -0.9;  // Player 1 side (-Z)
  bool isBackFace = normal.z > 0.9;    // Player 2 side (+Z)
  bool isSideFace = abs(normal.x) > 0.9;

  vec3 finalColor;

  if (isTopFace) {
    // ========== TOP FACE - Full effects ==========
    // Get tile coordinates
    vec2 tileCoords = getTileCoords(v_worldPos);

    // Checkerboard pattern
    float checker = mod(tileCoords.x + tileCoords.y, 2.0);
    vec3 baseColor = mix(COLOR_LIGHT, COLOR_DARK, checker);

    // Grid lines
    float gridLine = getGridLine(v_worldPos);
    baseColor = mix(baseColor, COLOR_GRID, gridLine * 0.8);

    // Valid placement highlight (green glow)
    float validIntensity = getValidPlacementIntensity(tileCoords);
    baseColor = mix(baseColor, COLOR_VALID, validIntensity);

    // Landmark preview highlight (golden glow, takes priority over valid placement)
    float landmarkIntensity = getLandmarkPreviewIntensity(tileCoords);
    baseColor = mix(baseColor, COLOR_LANDMARK, landmarkIntensity);

    // Hover highlight (takes priority over valid placement)
    float hoverIntensity = getHoverIntensity(tileCoords);
    baseColor = mix(baseColor, COLOR_HOVER, hoverIntensity * 0.4);

    // Lighting
    float diffuse = max(dot(normal, lightDir), 0.0);
    float ambient = 0.4;
    float light = ambient + diffuse * 0.6;

    // Specular highlight
    vec3 halfDir = normalize(lightDir + viewDir);
    float specular = pow(max(dot(normal, halfDir), 0.0), 32.0);

    finalColor = baseColor * light + vec3(1.0) * specular * 0.2;

    // Calculate glare with combined checker + noise normal perturbation
    vec3 perturbedNormal = getPerturbedNormal(tileCoords, checker, v_worldPos, u_time);
    float glare = calculateGlare(v_worldPos, perturbedNormal);

    // Add glare to final color (white glare highlight)
    finalColor += vec3(1.0) * glare;

    // Add surface grain with shimmer - visible texture that animates
    float grain = getSurfaceGrain(v_worldPos, u_time, checker);
    finalColor += vec3(grain);

    // Add slight vignette at edges
    float halfBoard = float(u_boardSize) * u_tileSize * 0.5;
    vec2 boardUV = v_worldPos.xz / halfBoard;
    float vignette = 1.0 - smoothstep(0.8, 1.2, length(boardUV));
    finalColor *= 0.9 + vignette * 0.1;

    // Player edge borders (enhanced visibility)
    vec4 playerEdge = getPlayerEdgeBorder(v_worldPos);
    if (playerEdge.a > 0.0) {
      // Stronger base blend
      finalColor = mix(finalColor, playerEdge.rgb, playerEdge.a * 0.8);
      // Stronger additive glow
      finalColor += playerEdge.rgb * playerEdge.a * 0.5;
      // Add subtle bloom with white highlight
      float glowBoost = playerEdge.a * 0.15;
      finalColor += vec3(glowBoost);
    }
  } else {
    // ========== SIDE FACES - Simplified darker rendering ==========
    // Base color for sides (darker than top)
    vec3 sideBaseColor = vec3(0.55, 0.55, 0.58);

    // Simple diffuse lighting
    float diffuse = max(dot(normal, lightDir), 0.0);
    float ambient = 0.35;
    float light = ambient + diffuse * 0.5;

    // Subtle specular
    vec3 halfDir = normalize(lightDir + viewDir);
    float specular = pow(max(dot(normal, halfDir), 0.0), 16.0);

    finalColor = sideBaseColor * light + vec3(1.0) * specular * 0.1;

    // Add player color tint to front/back faces
    if (isFrontFace) {
      // Player 1 side (blue tint)
      float edgeFade = smoothstep(0.0, 0.3, v_worldPos.y / 0.4);
      finalColor = mix(finalColor, COLOR_PLAYER1 * 0.7, 0.25 * edgeFade);
      // Subtle pulsing glow at top edge
      float pulse = 0.8 + 0.2 * sin(u_time * 2.0);
      float topGlow = smoothstep(0.2, 0.4, v_worldPos.y / 0.4) * 0.15 * pulse;
      finalColor += COLOR_PLAYER1 * topGlow;
    } else if (isBackFace) {
      // Player 2 side (red tint)
      float edgeFade = smoothstep(0.0, 0.3, v_worldPos.y / 0.4);
      finalColor = mix(finalColor, COLOR_PLAYER2 * 0.7, 0.25 * edgeFade);
      // Subtle pulsing glow at top edge
      float pulse = 0.8 + 0.2 * sin(u_time * 2.0 + 3.14159);
      float topGlow = smoothstep(0.2, 0.4, v_worldPos.y / 0.4) * 0.15 * pulse;
      finalColor += COLOR_PLAYER2 * topGlow;
    }

    // Darken bottom edge of sides for depth
    float bottomDarken = smoothstep(0.0, 0.15, v_worldPos.y / 0.4);
    finalColor *= 0.7 + 0.3 * bottomDarken;
  }

  fragColor = vec4(finalColor, 1.0);
}
