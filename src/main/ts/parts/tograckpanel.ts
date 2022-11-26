import Cut, { identityTransformations } from "../Cut";
import { boxPath } from "../pathutils";
import Part from "../Part";
import { rectangularArray, rectangularArrayPoints } from "../cuts";
import { number6PanelHole, number6PanelSlot } from "./commonholes";
import { SimpleTransformation2D } from "../Transformish";
import ComplexAmount, * as camt from "../ComplexAmount";
import { DISTANCE_UNITS } from "../units";
import { textToCut } from "../text";
import { getFont } from "../fonts";

type TOGRackHoleStyleName = "circular"|"alternating-ovals"

export interface TOGRackPanelOptions {
	length : ComplexAmount;
	holeStyleName? : TOGRackHoleStyleName,
	extraMargin? : ComplexAmount;
	labelText?: string;
	labelFontSize?: ComplexAmount;
	labelFontName?: string;
	labelDepth?: ComplexAmount;
	sketchDepth?: ComplexAmount;
	extraCuts?: Cut[];
}

const DEFAULT_SKETCH_DEPTH = camt.from("1/32in", DISTANCE_UNITS);
const DEFAULT_LABEL_FONT_SIZE = camt.from("3/8in", DISTANCE_UNITS);

export const togRackPanelMountingHole:Cut = number6PanelHole;

/** Generate an array of holes for a TOGRack panel; assumes top-left of panel is 0,0 */
export function makeTogRackPanelHoles(options:TOGRackPanelOptions):Cut {
	const len = camt.decode(options.length, "inch", DISTANCE_UNITS);
	const holeStyleName = options.holeStyleName ?? "circular";
	const colCount = len*2;
	const rowCount = 2;
	if( holeStyleName == "circular" ) {
		return rectangularArray([togRackPanelMountingHole], {x0: 0.25, y0:0.25, dx: 0.5, dy: 3.0, countX: colCount, countY:rowCount});
	} else if( holeStyleName == 'alternating-ovals' ) {
		const roundHoleArr = [togRackPanelMountingHole];
		const ovalHoleArr  = [number6PanelSlot];
		const components : Cut[] = [];
		for( let r=0; r<rowCount; ++r ) {
			for( let i=0; i<colCount; ++i ) {
				const xf = (r & 1) == 0 ?
					{x:   0 + 0.25 + i*0.5, y:       0.25, rotation: {degree: 90 * (i+0)}} :
					{x: len - 0.25 - i*0.5, y: 3.5 - 0.25, rotation: {degree: 90 * (i+1)}};
				components.push({
					classRef: "http://ns.nuke24.net/TTSGCG/Cut/Compound",
					transformations: [xf],
					components: (i == 0 || i == colCount-1) ? roundHoleArr : ovalHoleArr
				});
			}
		}
		return {
			classRef: "http://ns.nuke24.net/TTSGCG/Cut/Compound",
			transformations: identityTransformations,
			components
		};
	} else {
		throw new Error(`Unrecognized TOGRack hole style name: ${holeStyleName}`);
	}
}

export function makeTogRackPanelOutline(options:TOGRackPanelOptions):Cut {
	// Note: spaceSide: "middle" because otherwise I will need to do
	// path-adjustment-based-on-bit-radius calculations, which I haven't
	// yet gotten around to figuring out how to do.
	// This will be a problem if/when I go to use a larger bit.
	const extraMargin = camt.decode(options.extraMargin ?? {}, "inch", DISTANCE_UNITS);
	const len = camt.decode(options.length, "inch", DISTANCE_UNITS);
	return {
		classRef: "http://ns.nuke24.net/TTSGCG/Cut/TracePath",
		depth: Infinity,
		spaceSide: "middle",
		path: boxPath({
			x0: extraMargin, y0: extraMargin,
			width: len - extraMargin*2, height: 3.5 - extraMargin*2,
			cornerOptions: {
				cornerRadius: 1/4,
				cornerStyleName: "Round"
			},
		})
	}
}

export function makeTogRackPanel(options:TOGRackPanelOptions):Cut {
	const components : Cut[] = [];
	const sketchDepth = camt.decode(options.sketchDepth ?? DEFAULT_SKETCH_DEPTH, "inch", DISTANCE_UNITS);
	const lengthInches = camt.decode(options.length, "inch", DISTANCE_UNITS);
	const extraMarginInches = 0; // fer now; see WSTYP200311
	components.push({
		classRef: "http://ns.nuke24.net/TTSGCG/Cut/Compound",
		components: [{
			classRef: "http://ns.nuke24.net/TTSGCG/Cut/RoundHole",
			diameter: 0,
			depth: sketchDepth,
		}],
		transformations: [
			{x:              extraMarginInches, y:     extraMarginInches},
			{x: lengthInches-extraMarginInches, y:     extraMarginInches},
			{x: lengthInches-extraMarginInches, y: 3.5-extraMarginInches},
			{x:              extraMarginInches, y: 3.5-extraMarginInches},
		]
	});
	components.push(makeTogRackPanelHoles(options));
	if( options.labelText && options.labelText.length > 0 ) {
		const font = getFont(options.labelFontName ?? "tog-line-letters");
		const depth = camt.decode(options.labelDepth ?? {"inch": {numerator:1, denominator: 32}}, "inch", DISTANCE_UNITS);
		const scale = camt.decode(options.labelFontSize ?? {"inch": {numerator:3, denominator: 8}}, "inch", DISTANCE_UNITS);
		components.push({
			classRef: "http://ns.nuke24.net/TTSGCG/Cut/Compound",
			transformations: [{x: scale/2, y: 3, z: -depth, scale: scale}],
			components: [textToCut(options.labelText, font)]
		});
	}
	if( options.extraCuts ) components.push(...options.extraCuts);
	components.push(makeTogRackPanelOutline(options));
	return {
		classRef: "http://ns.nuke24.net/TTSGCG/Cut/Compound",
		unit: {"inches": {numerator:1, denominator:1}},
		transformations: identityTransformations,
		components
	};
}

function toString<X>(x:any, d:X) : string|X {
	return x == undefined ? d : ""+x;
}
function parseHoleStyleName(x:string, d:TOGRackHoleStyleName) : TOGRackHoleStyleName {
	if( x == undefined ) return d;
	switch( x ) {
	case "circular": case "alternating-ovals":
		return x;
	default:
		throw new Error(`Bad TOGRackHoleStyleName: '${x}'`);
	}
}

export function parsePartOptions(params:{[k:string]: any}) : TOGRackPanelOptions {
	return {
		length: camt.from(params.length ?? "1.5in", DISTANCE_UNITS),
		labelText: toString(params.labelText, undefined),
		labelFontName: toString(params.labelFontName, undefined),
		labelFontSize: params.labelFontSize ? camt.from(params.labelFontSize, DISTANCE_UNITS, "inch") : DEFAULT_LABEL_FONT_SIZE,
		holeStyleName: parseHoleStyleName(params.holeStyleName, "circular"),
		extraCuts: [],
	}
}

export default function makePart(params:{[k:string]: any}):Part {
	const options = parsePartOptions(params);
	return {
		name: "Blank "+options.length+"-inch TOGRack panel",
		cut: makeTogRackPanel(options),
	}
}
