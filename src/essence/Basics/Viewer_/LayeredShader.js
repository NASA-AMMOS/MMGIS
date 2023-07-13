/**
 * Credit: https://github.com/lebarba/WebGLVolumeRendering
 */

const LayeredShader = {
    vertexShaderFirstPass: `
		varying vec3 worldSpaceCoords;
		
		uniform float boxWidth;
		uniform float boxHeight;
		uniform float boxDepth;

		void main()
		{
			//Set the world space coordinates of the back faces vertices as output.
			worldSpaceCoords = position + vec3(boxWidth / 2.0, boxHeight / 2.0, boxDepth / 2.0); //move it from [-0.5;0.5] to [0,1]
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
		}
	`,
    fragmentShaderFirstPass: `
		varying vec3 worldSpaceCoords;
		void main()
		{
			//The fragment's world space coordinates as fragment output.
			gl_FragColor = vec4( worldSpaceCoords.x, worldSpaceCoords.y, worldSpaceCoords.z, 1 );
		}
	`,
    vertexShaderSecondPass: `
		varying vec3 worldSpaceCoords;
		varying vec4 projectedCoords;
		
		uniform float boxWidth;
		uniform float boxHeight;
		uniform float boxDepth;

		void main()
		{
			worldSpaceCoords = (modelMatrix * vec4(position + vec3(boxWidth / 2.0, boxHeight / 2.0, boxDepth / 2.0), 1.0 )).xyz;
			gl_Position = projectionMatrix *  modelViewMatrix * vec4( position, 1.0 );
			projectedCoords =  projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
		}
	`,
    fragmentShaderSecondPass: `
		varying vec3 worldSpaceCoords;
		varying vec4 projectedCoords;
		uniform sampler2D tex, cubeTex, transferTex;
		uniform float steps;
		uniform float alphaCorrection;
		uniform float boxWidth;
		uniform float boxHeight;
		uniform float boxDepth;
		// The maximum distance through our rendering volume is sqrt(3).
		// The maximum number of steps we take to travel a distance of 1 is 512.
		// ceil( sqrt(3) * 512 ) = 887
		// This prevents the back of the image from getting cut off when steps=512 & viewing diagonally.
		const int MAX_STEPS = 887;

		float linearScale(float domainStart, float domainEnd, float rangeStart, float rangeEnd, float value) {
			return ((rangeEnd - rangeStart) * (value - domainStart)) / (domainEnd - domainStart) + rangeStart;
		}

		const float slicesPerSide = 16.0;
		const float zDepth = slicesPerSide * slicesPerSide - 1.0;
		
		//Acts like a texture3D using Z slices and trilinear filtering.
		vec4 sampleAs3DTexture( vec3 texCoord )
		{
			texCoord.x = linearScale(0.0, boxWidth, 0.0, 1.0, texCoord.x);
			texCoord.y = linearScale(0.0, boxHeight, 0.0, 1.0, texCoord.y);

			vec4 colorSlice1, colorSlice2;
			vec2 texCoordSlice1, texCoordSlice2;

			//The z coordinate determines which Z slice we have to look for.
			//Z slice number goes from 0 to 255.
			float zSliceNumber1 = floor(texCoord.z * zDepth);

			//As we use trilinear we go the next Z slice.
			float zSliceNumber2 = min( zSliceNumber1 + 1.0, zDepth); //Clamp to 255

			//The Z slices are stored in a matrix of 16x16 of Z slices.
			//The original UV coordinates have to be rescaled by the tile numbers in each row and column.
			texCoord.xy /= slicesPerSide;

			texCoordSlice1 = texCoordSlice2 = texCoord.xy;

			//Add an offset to the original UV coordinates depending on the row and column number.
			texCoordSlice1.x += (mod(zSliceNumber1, slicesPerSide ) / slicesPerSide);
			texCoordSlice1.y += floor((zDepth - zSliceNumber1) / slicesPerSide) / slicesPerSide;

			texCoordSlice2.x += (mod(zSliceNumber2, slicesPerSide ) / slicesPerSide);
			texCoordSlice2.y += floor((zDepth - zSliceNumber2) / slicesPerSide) / slicesPerSide;

			//Get the opacity value from the 2D texture.
			//Bilinear filtering is done at each texture2D by default.
			colorSlice1 = texture2D( cubeTex, texCoordSlice1 );
			colorSlice2 = texture2D( cubeTex, texCoordSlice2 );

			//Based on the opacity obtained earlier, get the RGB color in the transfer function texture.
			colorSlice1.rgb = texture2D( transferTex, vec2( colorSlice1.a, 1.0) ).rgb;
			colorSlice2.rgb = texture2D( transferTex, vec2( colorSlice2.a, 1.0) ).rgb;

			//How distant is zSlice1 to ZSlice2. Used to interpolate between one Z slice and the other.
			float zDifference = mod(texCoord.z * zDepth, 1.0);

			//Finally interpolate between the two intermediate colors of each Z slice.
			return mix(colorSlice1, colorSlice2, zDifference);
		}


		void main( void ) {

			//Transform the coordinates it from [-1;1] to [0;1]
			vec2 texc = vec2(((projectedCoords.x / projectedCoords.w) + 1.0 ) / 2.0,
							((projectedCoords.y / projectedCoords.w) + 1.0 ) / 2.0 );

			//The back position is the world space position stored in the texture.
			vec3 backPos = texture2D(tex, texc).xyz;

			//The front position is the world space position of the second render pass.
			vec3 frontPos = worldSpaceCoords;

			//Using NearestFilter for rtTexture mostly eliminates bad backPos values at the edges
			//of the cube, but there may still be no valid backPos value for the current fragment.
			if ((backPos.x == 0.0) && (backPos.y == 0.0))
			{
				gl_FragColor = vec4(0.0);
				return;
			}

			//The direction from the front position to back position.
			vec3 dir = backPos - frontPos;

			float rayLength = length(dir);

			//Calculate how long to increment in each step.
			float delta = 1.0 / steps;

			//The increment in each direction for each step.
			vec3 deltaDirection = normalize(dir) * delta;
			float deltaDirectionLength = length(deltaDirection);

			//Start the ray casting from the front position.
			vec3 currentPosition = frontPos;

			//The color accumulator.
			vec4 accumulatedColor = vec4(0.0);

			//The alpha value accumulated so far.
			float accumulatedAlpha = 0.0;

			//How long has the ray travelled so far.
			float accumulatedLength = 0.0;

			//If we have twice as many samples, we only need ~1/2 the alpha per sample.
			//Scaling by 256/10 just happens to give a good value for the alphaCorrection slider.
			float alphaScaleFactor = 25.6 * delta;

			vec4 colorSample;
			float alphaSample;

			//Perform the ray marching iterations
			for(int i = 0; i < MAX_STEPS; i++)
			{
				//Get the voxel intensity value from the 3D texture.
				colorSample = sampleAs3DTexture( currentPosition );

				//Allow the alpha correction customization.
				alphaSample = colorSample.a * alphaCorrection;

				//Applying this effect to both the color and alpha accumulation results in more realistic transparency.
				alphaSample *= (1.0 - accumulatedAlpha);

				//Scaling alpha by the number of steps makes the final color invariant to the step size.
				alphaSample *= alphaScaleFactor;

				//Perform the composition.
				accumulatedColor += colorSample * alphaSample;

				//Store the alpha accumulated so far.
				accumulatedAlpha += alphaSample;

				//Advance the ray.
				currentPosition += deltaDirection;
				accumulatedLength += deltaDirectionLength;

				//If the length traversed is more than the ray length, or if the alpha accumulated reaches 1.0 then exit.
				if(accumulatedLength >= rayLength || accumulatedAlpha >= 1.0 )
					break;
			}

			gl_FragColor  = accumulatedColor;

		}
	`,
}

export { LayeredShader }
