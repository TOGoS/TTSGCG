import RationalNumber, { toRationalNumber, multiplyRationals, addRationals, parseRationalNumber, formatRationalNumber } from './RationalNumber';
import Unit, { UnitTable, getUnit } from './Unit';

export default interface ComplexAmount {[unitName:string]: RationalNumber}

export function scaleComplexAmount(a:ComplexAmount, s:number|RationalNumber):ComplexAmount {
	s = toRationalNumber(s);
	if( s.numerator == s.denominator ) return a;

	let res:ComplexAmount = {};
	for( let unitCode in a ) {
		res[unitCode] = multiplyRationals(a[unitCode], s);
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
			res[unitCode] = addRationals(res[unitCode], b[unitCode]);
		}
	}
	return res;
}

export function formatComplexAmount(amt:ComplexAmount):string {
    let parts:string[] = [];
    for( let u in amt ) {
        parts.push(formatRationalNumber(amt[u])+u);
    }
    return parts.join("+");
}

export function parseComplexAmount(caStr:string, unitTable:UnitTable):ComplexAmount {
	let m = /^(.*)(in|mm|board)$/.exec(caStr);
	if( m == null ) throw new Error("Invalid complex amount string: '"+caStr+"'");
    let unitName:string = m[2];
    let unit = getUnit(unitName, unitTable);
	return {
		[unitName]: parseRationalNumber(m[1])
	}
}

export function decodeComplexAmount(amount:ComplexAmount, nativeUnit:Unit, unitTable:UnitTable):number {
	let total = 0;
	for( let unitName in amount ) {
		if( unitName == nativeUnit.name ) {
			total += amount[unitName].numerator / amount[unitName].denominator;
		} else {
			let unit = unitTable[unitName];
			if( unit == undefined ) {
				throw new Error("Invalid unit "+unitName);
			}
			let value = unit.unitValue.numerator * amount[unitName].numerator / unit.unitValue.denominator / amount[unitName].denominator;
			total += nativeUnit.unitValue.denominator * value / nativeUnit.unitValue.numerator;
		}
	}
	return total;
}
