import Part from '../Part';
import { boxPath, PathBuilder, circlePath } from '../pathutils';
import Cut, { identityTransformations, RoundHole, ConicPocket, CompoundCut } from '../Cut';
import { inches } from '../units';
import { textToCut, Font } from '../text';
import { getFont } from '../fonts';
import Transformish from '../Transformish';

function mmAsInches(mm:number) {
	return mm / 25.4;
}

const boardThickness = 1/4; // That's what it's designed for!
const gridbeamHolePositions : Transformish[] = [
	{ x: -1.5, y: -1.5 },
	{ x: +1.5, y: -1.5 },
	{ x:  0  , y:  0   },
	{ x: -1.5, y: +1.5 },
	{ x: +1.5, y: +1.5 },
];

const fiftyMm = mmAsInches(50);

const m4HolePositions : Transformish[] = [
	{ x: -fiftyMm, y: -fiftyMm },
	{ x: +fiftyMm, y: -fiftyMm },
	{ x: -fiftyMm, y: +fiftyMm },
	{ x: +fiftyMm, y: +fiftyMm },
];

const label = {
	text: "WSTYPE-100390",
	fontName: "tog-line-letters",
	depth: 1/16,
};

function makeCountersunkM4Hole(bottomDepth:number) : Cut {
	const slopeWidth = mmAsInches(2); // Making it a bit larger than "needed"
	const bottomDiameter = mmAsInches(5);
	const conicPart : ConicPocket = {
		classRef: "http://ns.nuke24.net/TTSGCG/Cut/ConicPocket",
		bottomDepth: bottomDepth,
		edgeDepth: bottomDepth - slopeWidth,
		bottomDiameter,
		diameter: bottomDiameter + slopeWidth * 2,
		cutsBottom: false,
	}
	const holePart : RoundHole = {
		classRef: "http://ns.nuke24.net/TTSGCG/Cut/RoundHole",
		depth: Infinity,
		diameter: mmAsInches(5),
	}
	return {
		classRef: "http://ns.nuke24.net/TTSGCG/Cut/Compound",
		transformations: identityTransformations,
		components: [
			conicPart,
			holePart
		]
	}
}

interface PartOptions {
	labelText? : string;
	variationString? : "full"|"sketch"
}

function centeredLabel(text:string, font:Font, x:number, y:number, depth:number, maxWidth:number, maxHeight:number) : Cut {
	// Assuming single line for now...
	const nativeWidth = text.length;
	const nativeHeight = 1;

	const scale = Math.min( maxWidth / nativeWidth, maxHeight / nativeHeight );

	return {
		classRef: "http://ns.nuke24.net/TTSGCG/Cut/Compound",
		transformations: [{x: x - (nativeWidth * scale)/2, y: y + scale/2, z: -depth, scale: scale}],
		components: [textToCut(text, font)]
	}
}

function mkSketchHole(diameter:number, edgeDepth:number, centerDepth:number) : CompoundCut {
	return {
		classRef: "http://ns.nuke24.net/TTSGCG/Cut/Compound",
		transformations: identityTransformations,
		components: [
			{
				classRef: "http://ns.nuke24.net/TTSGCG/Cut/TracePath",
				spaceSide: "middle",
				path: circlePath(diameter/2),
			},
			{
				classRef: "http://ns.nuke24.net/TTSGCG/Cut/RoundHole",
				diameter: 0,
				depth: edgeDepth,
			}
		]
	}

}

export default function makePart(partOptions:PartOptions):Part {
	const panelWidth = 4.75;
	const isSketch = partOptions.variationString == "sketch";
	const sketchOutlineDepth = 1/16; // Lines for eyeballs
	const sketchPointDepth = 1/8; // Points for drill bits
	const edgeDepth = isSketch ? sketchOutlineDepth : Infinity;

	//console.error("partOptions:", partOptions, "isSketch:", isSketch);
	
	const realGridbeamHole : RoundHole = {
		classRef: "http://ns.nuke24.net/TTSGCG/Cut/RoundHole",
		diameter: 5/16,
		depth: Infinity,
	};
	const sketchGridbeamHole = mkSketchHole(5/16, sketchOutlineDepth, sketchPointDepth);
	const gridbeamHole = isSketch ? sketchGridbeamHole : realGridbeamHole;

	const realM4Hole = makeCountersunkM4Hole(boardThickness - 1/8);
	const m4Hole = isSketch ? sketchGridbeamHole : realM4Hole; // Eh, I'll know which is which!
	
	return {
		name: "WSTYPE-100390",
		cut: {
			classRef: "http://ns.nuke24.net/TTSGCG/Cut/Compound",
			transformations: identityTransformations,
			unit: inches(1),
			components: [
				// Gridbeam holes
				{
					classRef: "http://ns.nuke24.net/TTSGCG/Cut/Compound",
					transformations: gridbeamHolePositions,
					components: [
						gridbeamHole
					]
				},

				// M4 holes
				{
					classRef: "http://ns.nuke24.net/TTSGCG/Cut/Compound",
					transformations: m4HolePositions,
					components: [
						m4Hole
					]
				},

				// Model Label
				centeredLabel(label.text, getFont(label.fontName), 0, 3/4, label.depth, 4.5, 1),

				// Instance Label, if any
				centeredLabel(partOptions.labelText ?? "", getFont(label.fontName), 0, -3/4, label.depth, 4.5, 1),

				// Outline
				{
					classRef: "http://ns.nuke24.net/TTSGCG/Cut/TracePath",
					depth: edgeDepth,
					spaceSide: "middle", 
					path: boxPath({
						x0: -panelWidth/2, y0: -panelWidth/2,
						width: panelWidth, height: panelWidth,
						cornerOptions: {
							cornerRadius: 1/4,
							cornerStyleName: "Round"
						},
					})
				},
			],
		}
	}
}
