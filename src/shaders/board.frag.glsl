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

// Output
out vec4 fragColor;

// Constants
const vec3 COLOR_LIGHT = vec3(0.95, 0.95, 0.97);
const vec3 COLOR_DARK = vec3(0.85, 0.85, 0.88);
const vec3 COLOR_GRID = vec3(0.7, 0.7, 0.75);
const vec3 COLOR_HOVER = vec3(0.6, 0.8, 1.0);
const float GRID_WIDTH = 0.06;

// Get tile coordinates from world position
vec2 getTileCoords(vec3 worldPos) {
  float halfBoard = float(u_boardSize) * u_tileSize * 0.5;
  vec2 boardPos = worldPos.xz + halfBoard;
  return floor(boardPos / u_tileSize);
}

// Check if position is on grid line
float getGridLine(vec3 worldPos) {
  float halfBoard = float(u_boardSize) * u_tileSize * 0.5;
  vec2 boardPos = worldPos.xz + halfBoard;
  vec2 tilePos = mod(boardPos, u_tileSize);

  float lineX = smoothstep(0.0, GRID_WIDTH, tilePos.x) *
                smoothstep(0.0, GRID_WIDTH, u_tileSize - tilePos.x);
  float lineY = smoothstep(0.0, GRID_WIDTH, tilePos.y) *
                smoothstep(0.0, GRID_WIDTH, u_tileSize - tilePos.y);

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

void main() {
  // Get tile coordinates
  vec2 tileCoords = getTileCoords(v_worldPos);

  // Checkerboard pattern
  float checker = mod(tileCoords.x + tileCoords.y, 2.0);
  vec3 baseColor = mix(COLOR_LIGHT, COLOR_DARK, checker);

  // Grid lines
  float gridLine = getGridLine(v_worldPos);
  baseColor = mix(baseColor, COLOR_GRID, gridLine * 0.8);

  // Hover highlight
  float hoverIntensity = getHoverIntensity(tileCoords);
  baseColor = mix(baseColor, COLOR_HOVER, hoverIntensity * 0.4);

  // Simple lighting
  vec3 normal = normalize(v_normal);
  vec3 lightDir = normalize(u_lightDir);
  float diffuse = max(dot(normal, lightDir), 0.0);
  float ambient = 0.4;
  float light = ambient + diffuse * 0.6;

  // Specular highlight
  vec3 viewDir = normalize(u_cameraPos - v_worldPos);
  vec3 halfDir = normalize(lightDir + viewDir);
  float specular = pow(max(dot(normal, halfDir), 0.0), 32.0);

  vec3 finalColor = baseColor * light + vec3(1.0) * specular * 0.2;

  // Add slight vignette at edges
  float halfBoard = float(u_boardSize) * u_tileSize * 0.5;
  vec2 boardUV = v_worldPos.xz / halfBoard;
  float vignette = 1.0 - smoothstep(0.8, 1.2, length(boardUV));
  finalColor *= 0.9 + vignette * 0.1;

  fragColor = vec4(finalColor, 1.0);
}
