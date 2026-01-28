#version 300 es

precision highp float;

// Attributes
in vec3 a_position;
in vec3 a_normal;
in vec2 a_uv;

// Uniforms
uniform mat4 u_model;
uniform mat4 u_view;
uniform mat4 u_projection;

// Varyings
out vec3 v_position;
out vec3 v_normal;
out vec2 v_uv;
out vec3 v_worldPos;

void main() {
  vec4 worldPos = u_model * vec4(a_position, 1.0);
  v_worldPos = worldPos.xyz;
  v_position = a_position;
  v_normal = mat3(u_model) * a_normal;
  v_uv = a_uv;

  gl_Position = u_projection * u_view * worldPos;
}
