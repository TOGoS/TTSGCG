import RationalNumber, { simplify as simplifyRationalNumber, format, add, parse } from "./RationalNumber";

function assertEquals(expected:any, actual:any, onErrorMessage:string) {
    if( actual != expected ) {
        throw new Error("Expected " +expected+" got "+actual+": "+onErrorMessage);
    }
}

function assertEqualsRat(expected:RationalNumber, actual:RationalNumber, description:string) {
    assertEquals(expected.numerator, actual.numerator, description+" numerator");
    assertEquals(expected.denominator, actual.denominator, description+" denominator");
}

function _testParse(expected:RationalNumber, input:string) {
    assertEqualsRat(expected, parse(input), "parse('"+input+"')");
}

function testParse() {
    _testParse(rat(125,1000), "0.125");
    _testParse(rat(-1,3), "-1/3");
}


function _testSimplify(expected:RationalNumber, input:RationalNumber) {
    const formatted = format(input);
    assertEqualsRat(expected, simplifyRationalNumber(input), "simplify("+formatted+")");
}

function rat(numerator:number, denominator:number):RationalNumber {
    return {numerator, denominator};
}

function testSimplify() {
    _testSimplify(rat(1,1), rat(1,1));
    _testSimplify(rat(-1,3), rat(12,-36));
    _testSimplify(rat(3,1), rat(36,12));
    _testSimplify(rat(3,1), rat(-36,-12));
    _testSimplify(rat(0.1,1), rat(0.1,1));
}

function _testAdd(expected:RationalNumber, a:RationalNumber, b:RationalNumber) {
    assertEqualsRat(expected, add(a, b), format(a)+" + "+format(b));
}

function testAdd() {
    _testAdd(rat(2,1), rat(1,1), rat(1,1));
    _testAdd(rat(13,8), rat(3,2), rat(1,8));
    _testAdd(rat(5,6), rat(1,2), rat(1,3));
}

function _testFormat(expected:string, a:RationalNumber) {
    assertEquals(expected, format(a), "format("+a.numerator+"/"+a.denominator+")");
}

function testFormat() {
    _testFormat("1", rat(1,1));
    _testFormat("0.1", rat(0.1,1));
    _testFormat("0.1/2", rat(0.1,2));
    _testFormat("1/2", rat(1,2));
    _testFormat("-13/8", rat(-13,8));
}

testParse();
testSimplify();
testAdd();
testFormat();
