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
	let lines:TextCharacter[][] = [];
	let curLine:TextCharacter[] = [];
	let lineHeight = 0;
	let lineTop = 0;
	for( let i=0; i<text.length; ++i ) {
		let charKey = text.charAt(i);
		if( charKey == "\n" ) {
			lines.push(curLine);
			curLine = [];
			continue;
		}
		let char = charset.characters[charKey];
		if( char != undefined ) {
			lineHeight = Math.max(lineHeight, char.boundingBox.topY - char.boundingBox.bottomY);
			lineTop = Math.max(lineTop, char.boundingBox.topY);
			curLine.push(char);
		} else {
			throw new Error("No glyph defined for char: '"+charKey+"'");
		}
	}
	if( curLine ) lines.push(curLine);
	let right = 0;
	let top = -lineTop;;
	let components:Cut[] = [];
	for( let l in lines ) {
		let line = lines[l];
		for( let c in line ) {
			let char = line[c];
			let charWidth = char.boundingBox.rightX - char.boundingBox.leftX;
			components.push({
				classRef: "http://ns.nuke24.net/TTSGCG/Cut/Compound",
				transformations: [translationToTransform({x: right - char.boundingBox.leftX, y: top, z:0})],
				components: [char.cut]
			});
			right += charWidth;
		}
		right = 0;
		top -= lineHeight;
	}
	return {
		classRef: "http://ns.nuke24.net/TTSGCG/Cut/Compound",
		comment: '"' + text + '"',
		transformations: identityTransformations,
		components
	}
}
