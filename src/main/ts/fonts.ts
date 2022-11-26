import { Font, TextCharacter, TextBoundingBox } from './text';
import Cut, { identityTransformations } from './Cut';
import { Vector3D } from './vectormath';
import { boxPath } from './pathutils';
import { PathSegment, Path } from './Shape2D';

export const blockLetterBoundingBox:TextBoundingBox = {
	leftX: -0.5, rightX: 0.5,
	topY: 0.5, bottomY: -0.5,
}

export const togBlockLetters:Font = (() => {
	const aa =  0;
	const ab =  1;
	const ac =  2;
	const ad =  3;
	const ba =  4;
	const bb =  5;
	const bc =  6;
	const bd =  7;
	const ca =  8;
	const cb =  9;
	const cc = 10;
	const cd = 11;
	const da = 12;
	const db = 13;
	const dc = 14;
	const dd = 15;
	const outlinePath:Path = boxPath({
		width: 1, height: 1, cx: 0, cy: 0, cornerOptions: {
			cornerRadius: 1/8,
			cornerStyleName: "Round"
		}
	});
	const blockVertexes:Vector3D[] = [];
	for( let y=0; y<=3; ++y ) {
		for( let x=0; x<=3; ++x ) {
			blockVertexes.push({x: x / 3 - 0.5, y: 0.5 - y / 3, z:0});
		}
	}
	function mkblok(vertexLists:number[][]):TextCharacter {
		let cuts:Cut[] = [];
		for( let vl in vertexLists ) {
			let vertexList = vertexLists[vl];
			let segments:PathSegment[] = [];
			for( let i=0; i<vertexList.length-1; ++i ) {
				segments.push({
					typeName: "StraightPathSegment",
					startVertexIndex: vertexList[i],
					endVertexIndex: vertexList[i+1]
				});
			}
			cuts.push({
				classRef: "http://ns.nuke24.net/TTSGCG/Cut/TracePath",
				spaceSide: "middle",
				path: {
					classRef: "http://ns.nuke24.net/TTSGCG/Shape2D/Path",
					vertexes:blockVertexes,
					segments
				}
			});
		}
		return {
			boundingBox: blockLetterBoundingBox,
			cut: {
				classRef: "http://ns.nuke24.net/TTSGCG/Cut/Compound",
				transformations: identityTransformations,
				components: cuts
			}
		}
	}
	const outline = [aa,da,dd,ad,aa];
	const s_char = mkblok([outline,[bb,bd],[ca,cc]]);
	const z_char = mkblok([outline, [ba,bc], [cb,cd]]);
	return {
		characters: {
			"C": mkblok([[aa,da,dd,cd,cb,bb,bd,ad,aa]]),
			"E": mkblok([outline,[bb,bd],[cb,cd]]),
			"G": mkblok([outline,[bd,bb,cb,cc]]),
			"I": mkblok([[aa,ba,bb,cb,ca,da,dd,cd,cc,bc,bd,ad,aa]]),
			"M": mkblok([outline,[bb,db],[bc,dc]]),
			"T": mkblok([[aa,ba,bb,db,dc,bc,bd,ad,aa]]),
			"O": mkblok([outline,[bb,bc,cc,cb,bb]]),
			"Q": mkblok([outline,[bb,bc,cb,bb]]),
			"S": s_char,
			"W": mkblok([outline,[ab,cb],[ac,cc]]),
			"Z": z_char,
			"-": mkblok([[ba,ca,cd,bd,ba]]),
			"0": mkblok([outline,[bb,bc,cc,cb,bb]]),
			"1": mkblok([[aa,ba,bb,cb,ca,da,dd,cd,cc,ac,aa]]),
			"2": z_char,
			"3": mkblok([outline, [ba,bc], [ca,cc]]),
			"4": mkblok([[aa,ca,cc,dc,dd,ad,ac,bc,bb,ab,aa]]),
			"5": s_char,
			"6": mkblok([outline, [bb,bd], [cb,cc]]),
			"7": mkblok([[aa,ba,bc,dc,dd,ad,aa]]),
			"8": mkblok([outline, [bb,bc], [cb,cc]]),
			"9": mkblok([[aa,ca,cc,dc,dd,ad,aa],[bb,bc]]),
		}
	}
})();

export const togLineLetters:Font = (() => {
	const vertexes:Vector3D[] = [];
	for( let y=0.5; y<=4.5; ++y ) {
		for( let x=0.5; x<=4.5; ++x ) {
			vertexes.push({x: x/5 - 0.5, y: 0.5 - y/5, z:0});
		}
	}

	// Vertexes:
	//
	//   a b c d e
	// a . . . . .
	// b . . . . .
	// c . . . . .
	// d . . . . .
	// e . . . . .

	const aa =  0;
	const ab =  1;
	const ac =  2;
	const ad =  3;
	const ae =  4;
	const ba =  5;
	const bb =  6;
	const bc =  7;
	const bd =  8;
	const be =  9;
	const ca = 10;
	const cb = 11;
	const cc = 12;
	const cd = 13;
	const ce = 14;
	const da = 15;
	const db = 16;
	const dc = 17;
	const dd = 18;
	const de = 19;
	const ea = 20;
	const eb = 21;
	const ec = 22;
	const ed = 23;
	const ee = 24;
	// Use between vertexes to indicate 'not just a straight line'
	//const curve_left = 100;
	const cleft = "curve-left";
	const cright = "curve-right";
	type PathOp = number|["curve-left"|"curve-right",number];

	function mkblok(vertexLists:PathOp[][]):TextCharacter {
		let cuts:Cut[] = [];
		let points:Vector3D[] = [];
		for( let vl in vertexLists ) {
			let vertexList = vertexLists[vl];
			let segments:PathSegment[] = [];
			if( vertexList.length == 0 ) continue;
			let firstOp = vertexList[0];
			if( typeof(firstOp) !== "number" ) throw new Error("First item of vertex list must be a number");
			if( vertexList.length == 1 ) {
				points.push(vertexes[firstOp]);
				continue;
			}
			let prevVertexIndex:number = firstOp;
			let curveDirection:"left"|"right"|undefined;
			let curveAxisVertexIndex:number|undefined = undefined;
			for( let i=1; i<vertexList.length; ++i ) {
				let op = vertexList[i];
				if( typeof(op) == "number" ) {
					let nextVertexIndex = op;
					if( vertexes[prevVertexIndex] == undefined ) throw new Error("While building line letters, previous vertex index "+prevVertexIndex+" is invalid");
					if( vertexes[nextVertexIndex] == undefined ) throw new Error("While building line letters, next vertex index "+nextVertexIndex+" is invalid");
					if( curveAxisVertexIndex == undefined ) {
						segments.push({
							typeName: "StraightPathSegment",
							startVertexIndex: prevVertexIndex,
							endVertexIndex: nextVertexIndex
						});
					} else {
						if( vertexes[curveAxisVertexIndex] == undefined ) throw new Error("While building line letters, axis vertex index "+curveAxisVertexIndex+" is invalid");
						segments.push({
							//typeName: curveDirection == "left" ? "CounterClockwisePathSegment" : "ClockwisePathSegment",
							typeName: curveDirection == "right" ? "ClockwisePathSegment" : "CounterClockwisePathSegment",
							startVertexIndex: prevVertexIndex,
							endVertexIndex: nextVertexIndex,
							axisVertexIndex: curveAxisVertexIndex
						});
					}
					curveDirection = undefined;
					curveAxisVertexIndex = undefined;
					prevVertexIndex = nextVertexIndex;
				} else if( op[0] == cleft ) {
					curveDirection = "left";
					curveAxisVertexIndex = op[1];
				} else if( op[0] == cright ) {
					curveDirection = "right";
					curveAxisVertexIndex = op[1];
				} else {
					throw new Error("Bad path op: "+JSON.stringify(op));
				}
			}
			cuts.push({
				classRef: "http://ns.nuke24.net/TTSGCG/Cut/TracePath",
				path: {
					classRef: "http://ns.nuke24.net/TTSGCG/Shape2D/Path",
					vertexes,
					segments
				},
				spaceSide: "middle"
			});
		}
		if( points.length > 0 ) {
			cuts.push({
				classRef: "http://ns.nuke24.net/TTSGCG/Cut/RoundHole",
				diameter: 0,
				depth: 0,
			})
		}
		return {
			boundingBox: blockLetterBoundingBox,
			cut: {
				classRef: "http://ns.nuke24.net/TTSGCG/Cut/Compound",
				transformations: identityTransformations,
				components: cuts
			}
		}
	}
	const oCut:PathOp[] = [ac,[cleft,cc],ec,[cleft,cc],ac];
	// Priotity letters:
	// "TTSGCG"
	// "WSITEM-[0..9]"
	// "HEAT", "FAN", "AC", "COMM"
	// ACEFGHIMNOSTW
	return {
		characters: {
			"A": mkblok([[ea,ac,ec],[bc,bd]]),
			"B": mkblok([[aa,ea,ed,[cleft,dd],cd,[cleft,bd],ad,aa],[ca,cd]]),
			"C": mkblok([[ae,ac,[cleft,cc],ec,ee]]),
			"D": mkblok([[ac,aa,ea,ec,[cleft,cc],ac]]),
			"E": mkblok([[ae,aa,ea,ee],[ca,ce]]),
			"F": mkblok([[ae,aa,ea],[ca,ce]]),
			"G": mkblok([[ae,ac,[cleft,cc],ec,ee,ce,cc]]),
			"H": mkblok([[aa,ea],[ca,ce],[ae,ee]]),
			"I": mkblok([[aa,ae],[ac,ec],[ea,ee]]),
			"J": mkblok([[aa,ae],[ca,[cleft,cc],ce,ae]]),
			"M": mkblok([[ea,aa,cc,ae,ee]]),
			"N": mkblok([[ea,aa,ee,ae]]),
			"O": mkblok([oCut]),
			"P": mkblok([[ca,aa,ad,[cright,bd],cd,ca,ea]]),
			"R": mkblok([[ca,aa,ad,[cright,bd],cd,ca,ea],[cc,ee]]),
			"S": mkblok([[ae,ab,[cleft,bb],cb,cd,[cright,dd],ed,ea]]),
			"T": mkblok([[aa,ae],[ac,ec]]),
			"W": mkblok([[aa,da,[cleft,db],dc,[cleft,dd],de,ae],[ac,dc]]),
			"X": mkblok([[aa,ee],[ae,ea]]),
			"Y": mkblok([[aa,cc,ec,cc,ae]]),
			"Z": mkblok([[aa,ae,ea,ee]]),
			"-": mkblok([[ca,ce]]),
			"0": mkblok([oCut,[cc]]),
			"1": mkblok([[ba,ac,ec],[ea,ee]]),
			"2": mkblok([[aa,ad,[cright,bd],cd,cc,[cleft,ec],ea,ee]]),
			"3": mkblok([[aa,ad,[cright,bd],cd,[cright,dd],ed,ea],[ca,cd]]),
			"4": mkblok([[ed,ad,ca,ce]]),
			"5": mkblok([[ae,aa,ca,cd,[cright,dd],ed,ea]]),
			// TODO: Other numbers!
			"9": mkblok([[be,[cright,bd],cd,cb,[cright,bb],ab,ad,[cright,bd],be,ee]]),
		}
	}
})();

export function getFont(name:string):Font {
	switch(name) {
	case "tog-block-letters": return togBlockLetters;
	case "tog-line-letters": return togLineLetters;
	default:
		throw new Error("No such font: "+name);
	}
}
