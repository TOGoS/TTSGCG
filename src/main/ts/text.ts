import { Vector3D, translationToTransform } from './vectormath';
import { Path, PathSegment } from './Shape2D';
import { boxPath } from './pathutils';
import { SimpleTransformation2D } from './Transformish';
import Cut, { identityTransformations } from './Cut';

export interface TextBoundingBox {
	leftX:number;
	rightX:number;
	topY:number;
	bottomY:number;
}

type Shape2D = Path;

export interface TextCharacter {
	boundingBox: TextBoundingBox;
	cut: Cut;
}

export interface Font {
	characters: {[char:string]: TextCharacter};
}

export function textToCut(text:string, charset:Font):Cut {
	let x = 0;
	let chars:TextCharacter[] = [];
	for( let i=0; i<text.length; ++i ) {
		let charKey = text.charAt(i);
		let char = charset.characters[charKey];
		if( char != undefined ) {
			chars.push(char);
		}
	}
	let right = 0;
	let components:Cut[] = [];
	for( let c in chars ) {
		let char = chars[c];
		let charWidth = char.boundingBox.rightX - char.boundingBox.leftX;
		components.push({
			classRef: "http://ns.nuke24.net/TTSGCG/Cut/Compound",
			transformations: [translationToTransform({x: right - char.boundingBox.leftX, y: 0, z:0})],
			components: [char.cut]
		});
		right += charWidth;
	}
	return {
		classRef: "http://ns.nuke24.net/TTSGCG/Cut/Compound",
		transformations: identityTransformations,
		components
	}
}
