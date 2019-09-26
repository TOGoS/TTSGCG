export default interface RationalNumber {
	numerator: number;
	denominator: number;
}

const sumRegex = /.+\+.+/;
const rationalNumberRegex = /.+\/.+/;
const decimalNumberRegex = /^(?:([+-]?\d+)(?:\.(\d+))?)?/;

function gcd(a: number, b: number) {
	if( a % 1 != 0 || b % 1 != 0 ) return 1; // Don't fool with non-integers
	while( b !== 0 ) {
		const t = b;
		b = a % b;
		a = t;
	}
	return a
}

export function add(a:RationalNumber, b:RationalNumber) {
	return simplify({
		numerator: a.numerator*b.denominator + b.numerator*a.denominator,
		denominator: a.denominator*b.denominator
	})
}

export function multiply(a:RationalNumber, b:RationalNumber) {
	return simplify({
		numerator: a.numerator * b.numerator,
		denominator: a.denominator * b.denominator,
	})
}

export function divide(a:RationalNumber, b:RationalNumber) {
	return simplify({
		numerator: a.numerator * b.denominator,
		denominator: a.denominator * b.numerator,
	})
}

export function parse(numStr:string):RationalNumber {
	let m;
	if( sumRegex.exec(numStr) ) {
		return numStr.split('+').map(parse).reduce(add);
	} else if( rationalNumberRegex.exec(numStr) ) {
		return numStr.split('/').map(parse).reduce(divide);
	} else if( (m = decimalNumberRegex.exec(numStr)) ) {
		let decPart = m[2];
		let onesStr = m[1];
		let decimalPlaces = 0;
		if( decPart != undefined ) {
			onesStr += decPart;
			decimalPlaces = decPart.length;
		}
		return {numerator: +onesStr, denominator: Math.pow(10,decimalPlaces)};
	} else {
		throw new Error("Failed to parse '"+numStr+"' as number");
	}
}

export function from(n:number|RationalNumber):RationalNumber {
	if( typeof(n) == 'number' ) return simplify({ numerator:n, denominator:1});
	return n;
}

export function formatNumber(n:number):string {
	let def = ""+n;
	let fixed = n.toFixed(4);
	return def.length < fixed.length ? def : fixed;
}

export function format(n:RationalNumber, numFmt:(n:number)=>string=formatNumber):string {
	if( n.denominator == 1 ) return numFmt(n.numerator);
	return numFmt(n.numerator)+"/"+numFmt(n.denominator);
}

export function simplify(r:RationalNumber):RationalNumber {
	const commonDivisor = gcd(r.numerator, r.denominator)
	let numerator = r.numerator / commonDivisor;
	let denominator = r.denominator / commonDivisor;
	if( denominator < 0 ) {
		numerator = -numerator;
		denominator = -denominator;
	}
	return {numerator, denominator};
}
