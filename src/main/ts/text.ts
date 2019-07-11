import { Vector3D, translationToTransform } from './vectormath';
import { Shape, Path, PathSegment } from './shapes';
import { boxPath } from './pathutils';

export interface TextBoundingBox {
	leftX:number;
	rightX:number;
	topX:number;
	bottomX:number;
}

export interface TextCharacter {
	box: TextBoundingBox;
	shape: Shape;
}

export interface Font {
	characters: {[char:string]: TextCharacter};
}

export function textToShape(text:string, charset:Font):Shape {
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
	let subShapes:Shape[] = [];
	for( let c in chars ) {
		let char = chars[c];
		let charWidth = char.box.rightX - char.box.leftX;
		subShapes.push({
			typeName: "TransformShape",
			transformation: translationToTransform({x: right - char.box.leftX, y: 0, z:0}),
			subShape: char.shape
		});
		right += charWidth;
	}
	return {
		typeName: "MultiShape",
		subShapes
	}
}