/**
 * WSTYPE-200311
 * Design for 3.5" square TOGRack panel
 * with holes for 4 [toggle] buttons and 4 indicator LEDs.
 * Idea is to go in the WSTYPE-100391 / 'TOGRackBox' that I had Dad print on 2022-11-08,
 * and ultimately connect to 4 2.1mm barrel jacks to easily turn LED lights on/off.
 */

import StandardPartOptions from './StandardPartOptions';
import { decodeComplexAmount } from '../ComplexAmount';
import Cut, { identityTransformations, RoundHole } from '../Cut';
import Part from '../Part';
import { DISTANCE_UNITS, inches, millimeters, INCH, ONE_INCH } from '../units';
import { led5mmHoleDiameter, led5mmPanelHole, toggleButtonHoleDiameter, toggleButtonPanelHole } from './commonholes';
import { TOGRackPanelOptions, makeTogRackPanelOutline, makeTogRackPanelHoles } from './tograckpanel';

// Draft design as of 2022-11-09.
// TODO: Consider spacing button holes farther for LM2596 converter to sit between
// TODO: Maybe small breadboardesque holes on 0.1" grid

export default function makePart(options:StandardPartOptions):Part {
    const sketchDepth = decodeComplexAmount(options.sketchDepth, INCH, DISTANCE_UNITS);
    const edgeDepth = options.variationString == "sketch" ? sketchDepth : Infinity;
	
	const components : Cut[] = [];
	const panelOpts : TOGRackPanelOptions = {length: 3.5};
	
	components.push(makeTogRackPanelOutline(panelOpts))
	components.push(makeTogRackPanelHoles(panelOpts));
	const buttonHolePositions = [];
	const ledHolePositions = [];
	for( let x of [-1, 1] ) for( let y of [-1, 1] ) {
		buttonHolePositions.push({x: x*0.75+panelOpts.length/2, y: y*0.75+1.75});
		ledHolePositions.push(   {x: x*(1+3/8)+panelOpts.length/2, y: y*0.75+1.75});
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
