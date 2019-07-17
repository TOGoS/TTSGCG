export default interface RationalNumber {
	numerator: number;
	denominator: number;
}

const sumRegex = /.+\+.+/;
const rationalNumberRegex = /.+\/.+/;
const decimalNumberRegex = /^([+-]?\d+(?:\.(\d+))?)?/;

function lcm(a:number, b:number) {
	if( a == b ) return a;
	return a*b;
}

export function addRationals(a:RationalNumber, b:RationalNumber) {
	let sumDenominator = lcm(a.denominator, b.denominator);
	return {
		numerator: a.numerator*a.denominator/sumDenominator + b.numerator*b.denominator/sumDenominator,
		denominator: sumDenominator
	}
}

export function multiplyRationals(a:RationalNumber, b:RationalNumber) {
	return {
		numerator: a.numerator * b.numerator,
		denominator: a.denominator * b.denominator,
	}
}

export function divideRationals(a:RationalNumber, b:RationalNumber) {
	return {
		numerator: a.numerator * b.denominator,
		denominator: a.denominator * b.numerator,
	}
}

export function parseRationalNumber(numStr:string):RationalNumber {
	let m;
	if( sumRegex.exec(numStr) ) {
		return numStr.split('+').map(parseRationalNumber).reduce(addRationals);
	} else if( rationalNumberRegex.exec(numStr) ) {
		return numStr.split('/').map(parseRationalNumber).reduce(divideRationals);
	} else if( (m = decimalNumberRegex.exec(numStr)) ) {
		let decPart = m[2];
		let onesStr = m[1];
		let decimalPlaces = 0;
		if( decPart != undefined ) {
			onesStr += decPart;
			decimalPlaces = decPart.length;
		}
		return {numerator: +numStr, denominator: Math.pow(10,decimalPlaces)};
	} else {
		throw new Error("Failed to parse '"+numStr+"' as number");
	}
}

export function toRationalNumber(n:number|RationalNumber):RationalNumber {
	if( typeof(n) == 'number' ) return { numerator:n, denominator:1};
	return n;
}

export function numberFormat(n:number):string {
	let def = ""+n;
	let fixed = n.toFixed(4);
	if( def.length < fixed.length ) return def;
	return fixed;
}

export function formatRationalNumber(n:RationalNumber, numFmt:(n:number)=>string=numberFormat):string {
	if( n.denominator == 1 ) return numFmt(n.numerator);
	return n.numerator.toFixed(4)+"/"+n.denominator.toFixed(4);
}