import { type } from 'os';
import RationalNumber, * as rat from './RationalNumber';
import Unit, { UnitTable, getUnit } from './Unit';

export default interface ComplexAmount {[unitName:string]: RationalNumber}

export function scale(a:ComplexAmount, s:number|RationalNumber):ComplexAmount {
	s = rat.from(s);
	if( s.numerator == s.denominator ) return a;

	let res:ComplexAmount = {};
	for( let unitCode in a ) {
		res[unitCode] = rat.multiply(a[unitCode], s);
	}
	return res;
}
/** @deprecated - use 'scale' */
export const scaleComplexAmount = scale;

export function add(a:ComplexAmount, b:ComplexAmount):ComplexAmount {
	let res:ComplexAmount = {};
	for( let unitCode in a ) {
		res[unitCode] = a[unitCode];
	}
	for( let unitCode in b ) {
		if( res[unitCode] == undefined ) {
			res[unitCode] = b[unitCode];
		} else {
			res[unitCode] = rat.add(res[unitCode], b[unitCode]);
		}
	}
	return res;
}
/** @deprecated - use 'add' */
export const addComplexAmounts = add;

export function format(amt:ComplexAmount):string {
    let parts:string[] = [];
    for( let u in amt ) {
        parts.push(rat.format(amt[u])+u);
    }
    return parts.join("+");
}
/** @deprecated - use 'format' */
export const formatComplexAmount = format;

export function parse(caStr:string, unitTable:UnitTable):ComplexAmount {
	let m = /^(.*)(in|mm|board)$/.exec(caStr);
	if( m == null ) throw new Error("Invalid complex amount string: '"+caStr+"'");
    let unitName:string = m[2];
    let unit = getUnit(unitName, unitTable);
	return {
		[unitName]: rat.parse(m[1])
	}
}
/** @deprecated - use 'parse' */
export const parseComplexAmount = parse;

export function from(x:string|number|ComplexAmount, unitTable:UnitTable, defaultUnit?:Unit|string) : ComplexAmount {
	if( typeof(x) == 'object' ) return x as ComplexAmount;
	if( typeof(x) == 'string' ) {
		if( /^[\.|\d].*\d$/.exec(x) ) {
			if( defaultUnit == undefined ) {
				throw new Error(`Can't parse '${x}' as ComplexAmount; no default unit in this context`)
			}
			return {
				[unitName(defaultUnit)]: rat.parse(x)
			};
		} else {
			return parseComplexAmount(x, unitTable);
		}
	} else if( typeof(x) == 'number' ) {
		if( defaultUnit == undefined ) {
			throw new Error(`Can't convert number '${x}' to ComplexAmount; no default unit in this context`)
		}
		return {
			[unitName(defaultUnit)]: {numerator: x, denominator: 1}
		}
	} else {
		throw new Error(`Don't know how to derive ComplexAmount from ${typeof x} ${JSON.stringify(x)}`);
	}
}

function unitName(unit:Unit|string) : string {
	return (typeof(unit) == 'object') ? unit.name : unit;
}

export function decode(amount:ComplexAmount, nativeUnit:Unit|string, unitTable:UnitTable):number {
	const nativeUnitName = unitName(nativeUnit);
	if( typeof(nativeUnit) == 'string' ) nativeUnit = unitTable[nativeUnit];
	
	let total = 0;
	for( let unitName in amount ) {
		if( unitName == nativeUnitName ) {
			total += amount[unitName].numerator / amount[unitName].denominator;
		} else {
			let unit = getUnit(unitName, unitTable);
			let value = unit.unitValue.numerator * amount[unitName].numerator / unit.unitValue.denominator / amount[unitName].denominator;
			total += nativeUnit.unitValue.denominator * value / nativeUnit.unitValue.numerator;
		}
	}
	return total;
}
/** @deprecated - use 'decode' */
export const decodeComplexAmount = decode;

/**
 * Decode complex amount in the simple case that it is already defined
 * solely in terms of the desired unit (or is completely empty and therefore zero),
 * which allows us to not require a unit table to be passed-in.
 */
export function simpleDecode(amount:ComplexAmount, nativeUnit:Unit|string) : number {
	nativeUnit = unitName(nativeUnit);
	for( let k in amount ) {
		if( k == nativeUnit ) return amount[k].numerator / amount[k].denominator;
	}
	return 0;
}
/** @deprecated - use simpleDecode */
export const simpleDecodeComplexAmount = simpleDecode;