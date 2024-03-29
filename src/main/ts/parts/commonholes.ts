import { spawn } from "child_process";
import ComplexAmount, * as camt from "../ComplexAmount";
import { DISTANCE_UNITS, INCH, ONE_INCH } from "../units";
import Cut, { identityTransformations } from "../Cut";
import { rectangularArrayPoints, roundHole, slot } from "../cuts";
import { boxPath } from "../pathutils";
import RationalNumber, {divide as frac} from "../RationalNumber";
import Unit, {UnitTable} from "../Unit";

export const number6PanelHoleDiameter     = {"inch": frac( 5, 32)};
export const barrelInletPanelHoleDiameter = {"inch": frac( 5, 16)};
export const led5mmHoleDiameter           = {"inch": frac(13, 64)};
export const led5mmFlangeDiameter         = {"inch": frac(14, 64)};
export const toggleButtonHoleDiameter     = {"inch": frac( 1,  2)};

/** Approximate size of a 'dupont' 1/10-spaced pin, which is supposedly 0.65mm */
export const dupontPinWidth         = {"millimeter": frac(65, 100)};
export const solderJunctionPocketDiameter = {"inch": frac( 1,  20)}; // Enough to fit at least 4 small wires

type Unitish = Unit|string|ComplexAmount;

function isUnit(unit:Unit|ComplexAmount) : unit is Unit {
	// Assuming nobody would ever use
	// 'name' or 'unitValue' as a unit name...
	return unit.name != undefined && unit.unitValue != undefined;
}

function unitToComplexAmount(unit:Unitish) : ComplexAmount {
	if( typeof(unit) == 'string' ) {
		return {[unit]: {numerator:1, denominator:1}};
	} else if( isUnit(unit) ) {
		return {[unit.name]: {numerator:1, denominator:1}};
	} else {
		return unit;
	}
}

/** Cut with unit metadata addded */
function cutWithUnit(cut:Cut, unit:Unitish=ONE_INCH) : Cut {
	return {
		classRef: "http://ns.nuke24.net/TTSGCG/Cut/Compound",
		unit: unitToComplexAmount(unit),
		transformations: identityTransformations,
		components: [cut]
	};
}

function decodeAmount(amt:number|ComplexAmount, unit:Unit|string, unitTable:UnitTable) : number {
	return typeof(amt) == 'object' ? camt.decode(amt, unit, unitTable) : amt;
}

function roundHoleWithUnit(diameter:ComplexAmount|number, depth:ComplexAmount|number=Infinity, unit:Unit|string=INCH) : Cut {
	return cutWithUnit(roundHole(
		decodeAmount(diameter, unit, DISTANCE_UNITS),
		decodeAmount(depth, unit, DISTANCE_UNITS),
	), unit);
}

function slotWithUnit(
	width:ComplexAmount|number,
	height:ComplexAmount|number,
	depth:ComplexAmount|number=Infinity,
	unit:Unit|string=INCH
) : Cut {
	width  = decodeAmount(width , unit, DISTANCE_UNITS);
	height = decodeAmount(height, unit, DISTANCE_UNITS);
	depth  = decodeAmount(depth , unit, DISTANCE_UNITS);
	return cutWithUnit(slot(width, height, depth), unit);
}


export const number6PanelHole      : Cut = roundHoleWithUnit(number6PanelHoleDiameter    );
/** A number 6 panel hole, slightly long in the X direction */
export const number6PanelSlot      : Cut = slotWithUnit(number6PanelHoleDiameter, 1/4, Infinity, INCH);
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
export const lm2596PinHoleDxInches = camt.simpleDecode(lm2596PinHoleDx, "inch");
export const lm2596PinHoleDyInches = camt.simpleDecode(lm2596PinHoleDy, "inch");
export const lm2596HolePositionsInches = rectangularArrayPoints({
	dx: lm2596PinHoleDxInches,
	dy: lm2596PinHoleDyInches,
	countX: 2,
	countY: 2,
	cx: 0,
	cy: 0,
});

function makeSoldereJunctionHole(options:{depth:number, unitName:"inch"}) : Cut {
	return {
		classRef: "http://ns.nuke24.net/TTSGCG/Cut/RoundHole",
		depth: options.depth,
		diameter: camt.simpleDecode(solderJunctionPocketDiameter, options.unitName),
	};
}
export const solderJunctionHole = makeSoldereJunctionHole({depth: Infinity, unitName: "inch"});

export const pinHole = roundHole(0,Infinity);

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
				width : camt.simpleDecode(lm2596Width , options.unitName),
				height: camt.simpleDecode(lm2596Height, options.unitName),
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
