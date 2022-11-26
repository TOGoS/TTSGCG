/**
 * WSTYPE-200311
 * Design for 3.5" square TOGRack panel
 * with holes for 4 [toggle] buttons and 4 indicator LEDs.
 * Idea is to go in the WSTYPE-100391 / 'TOGRackBox' that I had Dad print on 2022-11-08,
 * and ultimately connect to 4 2.1mm barrel jacks to easily turn LED lights on/off.
 */

import StandardPartOptions from './StandardPartOptions';
import * as camt from '../ComplexAmount';
import Cut, { identityTransformations, RoundHole } from '../Cut';
import Part from '../Part';
import { Font, textToCut } from '../text';
import { DISTANCE_UNITS, inches, millimeters, INCH, ONE_INCH } from '../units';
import { dupontPinWidth, led5mmHoleDiameter, led5mmPanelHole, makeLm2596Pad, solderJunctionPocketDiameter, toggleButtonHoleDiameter, toggleButtonPanelHole } from './commonholes';
import { TOGRackPanelOptions, makeTogRackPanelOutline, makeTogRackPanelHoles } from './tograckpanel';
import { rectangularArray, roundHole } from '../cuts';
import { getFont } from '../fonts';

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


// Draft design as of 2022-11-09.
// TODO: Consider spacing button holes farther for LM2596 converter to sit between
// TODO: Maybe small breadboardesque holes on 0.1" grid

export default function makePart(options:StandardPartOptions):Part {
	const labelText = options.labelText ?? "WSTYPE-200311";
	const sketchDepth = camt.decode(options.sketchDepth, INCH, DISTANCE_UNITS);
	const labelDepth = camt.decode(options.labelDepth, INCH, DISTANCE_UNITS);
	const edgeDepth = options.variationString == "sketch" ? sketchDepth : Infinity;
	const extraMargin = {"inch": {numerator: 1, denominator: 32}};
	const pinholeDepth = Math.min(
		options.maxPocketDepth ? camt.decode(options.maxPocketDepth, INCH, DISTANCE_UNITS) : Infinity,
		3/16,
	);

	const pinHole = roundHole(camt.decode(dupontPinWidth, INCH, DISTANCE_UNITS), pinholeDepth);
	const sjHole = roundHole(camt.decode(solderJunctionPocketDiameter, INCH, DISTANCE_UNITS), pinholeDepth);
	
	const components : Cut[] = [];
	const panelOpts : TOGRackPanelOptions = {
		length: {"inch": {numerator: 7, denominator: 2}},
		// Since the 3D-printed TOGRackBox, WSITEM-200314, isn't exactly square,
		// make slighly larger holes and give some extra margin
		holeStyleName: "alternating-ovals",
		extraMargin,
	};
	const extraMarginInches = camt.decode(extraMargin, "inch", DISTANCE_UNITS);
	const lengthInches = camt.decode(panelOpts.length, "inch", DISTANCE_UNITS);
	const cx = lengthInches/2;
	const cy = 3.5/2;
	const centerPosition = { x: cx, y: cy };
	
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
	components.push(makeTogRackPanelHoles(panelOpts));
	const buttonHolePositions = [];
	const ledHolePositions = [];
	for( let i of [-1, 1] ) for( let j of [-1, 1] ) {
		buttonHolePositions.push({x: cx + i*(1    ), y: cy + j*0.50});
		ledHolePositions.push(   {x: cx + i*(1+1/2), y: cy + j*0.50});
	}
	components.push({
		classRef: "http://ns.nuke24.net/TTSGCG/Cut/Compound",
		transformations: buttonHolePositions,
		components: [toggleButtonPanelHole]
	});
	components.push({
		classRef: "http://ns.nuke24.net/TTSGCG/Cut/Compound",
		transformations: ledHolePositions,
		components: [led5mmPanelHole]
	});
	components.push({
		classRef: "http://ns.nuke24.net/TTSGCG/Cut/Compound",
		transformations: [centerPosition],
		components: [
			makeLm2596Pad({
				pinhole: sjHole,
				outlineDepth: sketchDepth,
				unitName: "inch",
			}),
		]
	});

	const decorationEdgeOffsetY = 5/8;
	const pinholeYPositions = [decorationEdgeOffsetY, cy];

	if( labelText.length > 0 && labelDepth > 0 ) {
		components.push(centeredLabel(labelText, getFont("tog-line-letters"), cx, 3.5-decorationEdgeOffsetY, labelDepth, 3, 1/4));
	} else {
		pinholeYPositions.push(3.5-decorationEdgeOffsetY);
	}
	
	// Fat pinholes to provide places to solder wires together
	// and have the joint be safely tucked away
	for( const y of pinholeYPositions ) {
		components.push(rectangularArray(
			[sjHole],
			{countX: 8, countY: 1, dx:4/10, dy:1/2, cx, cy:y}
		));
	}
	components.push(makeTogRackPanelOutline(panelOpts));
	
	return {
		name: "WSTYPE-200311",
		cut: {
			classRef: "http://ns.nuke24.net/TTSGCG/Cut/Compound",
			unit: ONE_INCH,
			transformations: identityTransformations,
			components
		}
	};
}
