import ComplexAmount from "./ComplexAmount";
import Unit from "./Unit";
import * as rational from './RationalNumber';

export const INCH : Unit = {
	unitValue: {numerator:254, denominator:10},
	name: "inch",
	abbreviation: "in",
	aliases: ["inch", "in", '"', "inch", "inches"],
};

export const MM : Unit = {
	unitValue: rational.from(1),
	name: "millimeter",
	abbreviation: "mm",
	aliases: ["millimeter", "mm", "millimeters"],
};

export const DISTANCE_UNITS:{[k:string]:Unit} = {
	"inch": INCH,
	"millimeter": MM,
}

export function amount(unitName:string, numerator:number, denominator:number=1):ComplexAmount {
	return { [unitName]: {numerator, denominator} };
}
export function inches(numerator:number, denominator:number=1):ComplexAmount {
	return amount("inch", numerator, denominator);
}
export function millimeters(numerator:number, denominator:number=1):ComplexAmount {
	return amount("millimeter", numerator, denominator);
}

export const ONE_INCH:ComplexAmount = inches(1);
export const ONE_MM:ComplexAmount = millimeters(1);

