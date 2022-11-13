import { spawn } from "child_process";
import ComplexAmount, {decodeComplexAmount, simpleDecodeComplexAmount} from "../ComplexAmount";
import { DISTANCE_UNITS, INCH, ONE_INCH } from "../units";
import Cut, { identityTransformations } from "../Cut";
import { rectangularArrayPoints, roundHole } from "../cuts";
import { boxPath } from "../pathutils";
import RationalNumber, {divide as frac} from "../RationalNumber";
import Unit from "../Unit";

export const number6PanelHoleDiameter     = {"inch": frac( 5, 32)};
export const barrelInletPanelHoleDiameter = {"inch": frac( 5, 16)};
export const led5mmHoleDiameter           = {"inch": frac(13, 64)};
export const led5mmFlangeDiameter         = {"inch": frac(14, 64)};
export const toggleButtonHoleDiameter     = {"inch": frac( 1,  2)};

/** Approximate size of a 'dupont' 1/10-spaced pin, which is supposedly 0.65mm */
export const dupontPinWidth         = {"millimeter": frac(65, 100)};
export const solderJunctionPocketDiameter = {"inch": frac( 1,  16)};

/** Cut with unit metadata addded */
function cutWithUnit(cut:Cut, unit:ComplexAmount=ONE_INCH) : Cut {
	return {
		classRef: "http://ns.nuke24.net/TTSGCG/Cut/Compound",
		unit,
		transformations: identityTransformations,
		components: [cut]
	};
}

function roundHoleWithUnit(diameter:ComplexAmount|number, depth:ComplexAmount|number=Infinity, unit:Unit|string=INCH) : Cut {
	return cutWithUnit(roundHole(
		typeof(diameter) == 'object' ? decodeComplexAmount(diameter, unit, DISTANCE_UNITS) : diameter,
		typeof(depth)    == 'object' ? decodeComplexAmount(depth, unit, DISTANCE_UNITS)    : depth   
	));
}

export const number6PanelHole      : Cut = roundHoleWithUnit(number6PanelHoleDiameter    );
export const barrelInletPanelHole  : Cut = roundHoleWithUnit(barrelInletPanelHoleDiameter);
export const led5mmPanelHole       : Cut = {
	classRef: "http://ns.nuke24.net/TTSGCG/Cut/Compound",
	components: [
		roundHoleWithUnit(led5mmHoleDiameter       ),
		roundHoleWithUnit(led5mmHoleDiameter, 3/64 ),
	],
	transformations: identityTransformations,
};
export const toggleButtonPanelHole : Cut = roundHoleWithUnit(toggleButtonHoleDiameter    );

// 1.56 x 0.7

export const lm2596Width     : ComplexAmount = {"inch": frac( 84, 100)};
export const lm2596Height    : ComplexAmount = {"inch": frac(170, 100)};
export const lm2596PinHoleDx : ComplexAmount = {"inch": frac( 70, 100)};
export const lm2596PinHoleDy : ComplexAmount = {"inch": frac(157, 100)};
export const lm2596PinHoleDxInches = simpleDecodeComplexAmount(lm2596PinHoleDx, "inch");
export const lm2596PinHoleDyInches = simpleDecodeComplexAmount(lm2596PinHoleDy, "inch");
export const lm2596HolePositionsInches = rectangularArrayPoints({
	dx: lm2596PinHoleDxInches,
	dy: lm2596PinHoleDyInches,
	countX: 2,
	countY: 2,
	cx: 0,
	cy: 0,
});

function makeWireJunctionHole(options:{depth:number, unitName:"inch"}) : Cut {
	return {
		classRef: "http://ns.nuke24.net/TTSGCG/Cut/RoundHole",
		depth: options.depth,
		diameter: simpleDecodeComplexAmount(solderJunctionPocketDiameter, options.unitName),
	};
}

export function makeLm2596Pad(options:{pinhole?:Cut, outlineDepth:number, unitName:"inch"}) : Cut {
	const components : Cut[] = [];
	if( options.pinhole ) {
		components.push({
			classRef: "http://ns.nuke24.net/TTSGCG/Cut/Compound",
			components: [options.pinhole],
			transformations: lm2596HolePositionsInches
		})
	};
	if( options.outlineDepth > 0 ) {
		components.push({
			classRef: "http://ns.nuke24.net/TTSGCG/Cut/TracePath",
			path: boxPath({
				cornerOptions: {cornerRadius: 0, cornerStyleName: "Round"},
				cx: 0, cy: 0,
				width : simpleDecodeComplexAmount(lm2596Width , options.unitName),
				height: simpleDecodeComplexAmount(lm2596Height, options.unitName),
			}),
			depth: options.outlineDepth,
			spaceSide: "middle",
		});
	}

	return {
		classRef: "http://ns.nuke24.net/TTSGCG/Cut/Compound",
		components,
		transformations: identityTransformations
	};
}
