import { type } from 'os';
import RationalNumber, { from, multiply, add, parse, format } from './RationalNumber';
import Unit, { UnitTable, getUnit } from './Unit';

export default interface ComplexAmount {[unitName:string]: RationalNumber}

export function scaleComplexAmount(a:ComplexAmount, s:number|RationalNumber):ComplexAmount {
	s = from(s);
	if( s.numerator == s.denominator ) return a;

	let res:ComplexAmount = {};
	for( let unitCode in a ) {
		res[unitCode] = multiply(a[unitCode], s);
	}
	return res;
}

export function addComplexAmounts(a:ComplexAmount, b:ComplexAmount):ComplexAmount {
	let res:ComplexAmount = {};
	for( let unitCode in a ) {
		res[unitCode] = a[unitCode];
	}
	for( let unitCode in b ) {
		if( res[unitCode] == undefined ) {
			res[unitCode] = b[unitCode];
		} else {
			res[unitCode] = add(res[unitCode], b[unitCode]);
		}
	}
	return res;
}

export function formatComplexAmount(amt:ComplexAmount):string {
    let parts:string[] = [];
    for( let u in amt ) {
        parts.push(format(amt[u])+u);
    }
    return parts.join("+");
}

export function parseComplexAmount(caStr:string, unitTable:UnitTable):ComplexAmount {
	let m = /^(.*)(in|mm|board)$/.exec(caStr);
	if( m == null ) throw new Error("Invalid complex amount string: '"+caStr+"'");
    let unitName:string = m[2];
    let unit = getUnit(unitName, unitTable);
	return {
		[unitName]: parse(m[1])
	}
}

function unitName(unit:Unit|string) : string {
	return (typeof(unit) == 'object') ? unit.name : unit;
}

export function decodeComplexAmount(amount:ComplexAmount, nativeUnit:Unit|string, unitTable:UnitTable):number {
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

/**
 * Decode complex amount in the simple case that it is already defined
 * solely in terms of the desired unit (or is completely empty and therefore zero),
 * which allows us to not require a unit table to be passed-in.
 */
export function simpleDecodeComplexAmount(amount:ComplexAmount, nativeUnit:Unit|string) : number {
	nativeUnit = unitName(nativeUnit);
	for( let k in amount ) {
		if( k == nativeUnit ) return amount[k].numerator / amount[k].denominator;
	}
	return 0;
}
