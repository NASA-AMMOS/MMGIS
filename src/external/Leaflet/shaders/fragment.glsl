precision mediump float;
uniform vec2 u_resolution;
uniform float u_angle;
uniform float u_width;
uniform float u_spacing;
uniform float u_length;
uniform float u_interval;
uniform float u_speed;
uniform float u_time;
uniform int u_color;

float drawCoord(float coord, float fill, float gap) {
    float patternLength = fill + gap;
    float modulo = mod(coord, patternLength);

    return step(modulo, patternLength - gap);
}

vec3 getColor(int color) {
    float red = float(color / 256 / 256);
    float green = float(color / 256 - int(red * 256.0));
    float blue = float(color - int(red * 256.0 * 256.0) - int(green * 256.0));

    return vec3(red / 255.0, green / 255.0, blue / 255.0);
}

void main() {
    mat2 rotationMatrix = mat2(
        cos(u_angle), -sin(u_angle),
        sin(u_angle), cos(u_angle)
    );

    vec2 rotatedFragCoord = rotationMatrix * gl_FragCoord.xy;

    float yShift = u_time * u_speed;
    float drawX = drawCoord(rotatedFragCoord.x, u_width, u_spacing);
    float drawY = drawCoord(rotatedFragCoord.y + yShift, u_length, u_interval);

    float draw = drawX * drawY;

    if (!bool(draw)) discard;

    vec3 color = getColor(u_color);

    gl_FragColor = vec4(color, 1.0);
}
