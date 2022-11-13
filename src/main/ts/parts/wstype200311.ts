/**
 * WSTYPE-200311
 * Design for 3.5" square TOGRack panel
 * with holes for 4 [toggle] buttons and 4 indicator LEDs.
 * Idea is to go in the WSTYPE-100391 / 'TOGRackBox' that I had Dad print on 2022-11-08,
 * and ultimately connect to 4 2.1mm barrel jacks to easily turn LED lights on/off.
 */

import StandardPartOptions from './StandardPartOptions';
import { decodeComplexAmount, simpleDecodeComplexAmount } from '../ComplexAmount';
import Cut, { identityTransformations, RoundHole } from '../Cut';
import Part from '../Part';
import { DISTANCE_UNITS, inches, millimeters, INCH, ONE_INCH } from '../units';
import { dupontPinWidth, led5mmHoleDiameter, led5mmPanelHole, makeLm2596Pad, solderJunctionPocketDiameter, toggleButtonHoleDiameter, toggleButtonPanelHole } from './commonholes';
import { TOGRackPanelOptions, makeTogRackPanelOutline, makeTogRackPanelHoles } from './tograckpanel';
import { rectangularArray, roundHole } from '../cuts';

// Draft design as of 2022-11-09.
// TODO: Consider spacing button holes farther for LM2596 converter to sit between
// TODO: Maybe small breadboardesque holes on 0.1" grid

export default function makePart(options:StandardPartOptions):Part {
    const sketchDepth = decodeComplexAmount(options.sketchDepth, INCH, DISTANCE_UNITS);
    const edgeDepth = options.variationString == "sketch" ? sketchDepth : Infinity;
	const pinholeDepth = Math.min(
		options.maxPocketDepth ? decodeComplexAmount(options.maxPocketDepth, INCH, DISTANCE_UNITS) : Infinity,
		3/16,
	);

	const pinHole = roundHole(decodeComplexAmount(dupontPinWidth, INCH, DISTANCE_UNITS), pinholeDepth);
	const sjHole = roundHole(decodeComplexAmount(solderJunctionPocketDiameter, INCH, DISTANCE_UNITS), pinholeDepth);
	
	const components : Cut[] = [];
	const panelOpts : TOGRackPanelOptions = {length: 3.5};
	const cx = panelOpts.length/2;
	const cy = 3.5/2;
	const centerPosition = { x: cx, y: cy };
	
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
	/*
	components.push(rectangularArray(
		[pinHole],
		{countX: 31, countY: 5, dx:1/10, dy:1/10, cx, cy}
	));
	*/
	components.push(rectangularArray(
		[sjHole],
		{countX: 8, countY: 1, dx:4/10, dy:1/2, cx, cy}
	));
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
