import Part from '../Part';
import { PathBuilder, boxPath } from '../pathutils';
import { makeTogRackPanelOutline } from './tograckpanel';
import Cut, { identityTransformations, RoundHole, ConicPocket } from '../Cut';
import { inches } from '../units';
import { textToCut } from '../text';
import { getFont } from '../fonts';
import Transformish from '../Transformish';
import { translationToTransform, multiplyTransform, scaleToTransform } from '../vectormath';

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
	fontScale: 1/4,
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

export default function makePart():Part {
	const panelWidth = 4.75;
	
	const gridbeamHole : RoundHole = {
		classRef: "http://ns.nuke24.net/TTSGCG/Cut/RoundHole",
		diameter: 5/16,
		depth: Infinity,
	};

	const m4Hole = makeCountersunkM4Hole(boardThickness - 1/8);
	
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

				// Label
				{
					classRef: "http://ns.nuke24.net/TTSGCG/Cut/Compound",
					transformations: [{x: 0 - (label.text.length * label.fontScale)/2, y: 3/4 + label.fontScale/2, z: label.depth, scale: label.fontScale}],
					components: [textToCut(label.text, getFont(label.fontName))]
				},

				// Outline
				{
					classRef: "http://ns.nuke24.net/TTSGCG/Cut/TracePath",
					depth: Infinity,
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
