import * as aabb from './aabb';
import { AABB3D } from './aabb';
import * as vectormath from './vectormath';
import { TransformationMatrix3D, Vector3D } from './vectormath';

// Vector3D = {x:Number, y:Number, z:Number}
// StraightPathSegment = 
// PathSegment = StraightPathSegment|ArcPathSegment
// Path = { vertexes: Vector3D[], segments: PathSegment[] }

interface StraightPathSegment {
	typeName:"StraightPathSegment";
	startVertexIndex:number;
	endVertexIndex:number;
}
interface CurvedPathSegment {
	typeName:"ClockwisePathSegment"|"CounterClockwisePathSegment";
	startVertexIndex:number;
	endVertexIndex:number;
	axisVertexIndex:number;
}
type PathSegment = StraightPathSegment|CurvedPathSegment;

interface Path {
	typeName: "Path";
	vertexes: Vector3D[];
	segments: PathSegment[];
}

function vectorToString(v:Vector3D, digits=4):string {
	return "<"+v.x.toFixed(digits)+","+v.y.toFixed(digits)+","+v.z.toFixed(digits)+">";
}

type CornerStyleName = "Chamfer"|"Round";

class PathBuilder
{
	public path:Path;
	protected currentVertexIndex:number=0;
	protected vertexIndexes:{[v:string]:number} = {};
	protected _currentDirection:Vector3D = {x:1, y:0, z:0};
	constructor(startPoint:Vector3D) {
		this.path = {
			typeName: "Path",
			vertexes: [startPoint],
			segments: []
		};
	}
	protected findVertex(pos:Vector3D):number {
		const key = pos.x+","+pos.y+","+pos.z;
		let idx = this.vertexIndexes[key];
		if( idx != undefined ) return idx;
		this.path.vertexes.push(pos);
		idx = this.path.vertexes.length-1;
		this.vertexIndexes[key] = idx;
		return idx;
	}

	lineTo(vec:Vector3D):PathBuilder {
		if(vectormath.vectorsAreEqual(vec, this.currentPosition)) return this;

		let endVertexIndex = this.findVertex(vec);
		this.path.segments.push({
			typeName: "StraightPathSegment",
			startVertexIndex: this.currentVertexIndex,
			endVertexIndex,
		})
		this.currentDirection = vectormath.subtractVectors(this.path.vertexes[endVertexIndex], this.path.vertexes[this.currentVertexIndex]);
		this.currentVertexIndex = endVertexIndex;
		return this;
	}
	set currentDirection(dir:Vector3D) {
		this._currentDirection = vectormath.normalizeVector(dir);
	}
	get currentPosition():Vector3D {
		if(this.currentVertexIndex == undefined) throw new Error("Path not yet started");
		return this.path.vertexes[this.currentVertexIndex];
	}
	turn(angle:number, radius:number=0, shape:CornerStyleName="Round"):PathBuilder {
		if(this.currentVertexIndex == undefined) throw new Error("Path not yet started");
		if( radius != 0 ) {
			const currentPosition = this.path.vertexes[this.currentVertexIndex];
			const forward = vectormath.scaleVector(this._currentDirection, radius);
			const toAxisFromStart = vectormath.transformVector(vectormath.xyzAxisAngleToTransform(0,0,angle > 0 ? 1 : -1,Math.PI/2), forward);
			const toAxisFromEnd = vectormath.transformVector(vectormath.xyzAxisAngleToTransform(0,0,1,angle), toAxisFromStart);
			const axisPosition = vectormath.addVectors(currentPosition, toAxisFromStart);
			const endPosition = vectormath.subtractVectors(axisPosition, toAxisFromEnd);
			//console.log("(forward = "+vectorToString(forward)+"; turned = "+vectorToString(turned)+"; start = "+vectorToString(currentPosition)+"; end = "+vectorToString(endPosition)+")");
			const axisVertexIndex = this.findVertex(axisPosition)
			const endVertexIndex = this.findVertex(endPosition);
			if( shape == "Round" ) {
				this.path.segments.push({
					typeName: angle < 0 ? "ClockwisePathSegment" : "CounterClockwisePathSegment",
					startVertexIndex: this.currentVertexIndex,
					endVertexIndex,
					axisVertexIndex,
				});
			} else {
				this.path.segments.push({
					typeName: "StraightPathSegment",
					startVertexIndex: this.currentVertexIndex,
					endVertexIndex,
				});
			}
			this.currentVertexIndex = endVertexIndex;
		}
		this.currentDirection = vectormath.transformVector(vectormath.xyzAxisAngleToTransform(0,0,1,angle), this._currentDirection);
		return this;
	}
	lineToCornerStart(cornerPosition:Vector3D, angle:number, radius:number) {
		const forward = vectormath.subtractVectors(cornerPosition, this.currentPosition);
		const cornerLength = radius * Math.sin(angle); // I think
		const forwardLength = vectormath.vectorLength(forward);
		const shortenedLength = forwardLength - cornerLength;
		const shortened = vectormath.scaleVector(forward, shortenedLength / forwardLength);
		this.lineTo(vectormath.addVectors(this.currentPosition, shortened));
	}

	curveTo(vec:Vector3D, endForward:Vector3D):PathBuilder {
		throw new Error("CurveTo not yet implemented");
	}

	closeLoop():PathBuilder {
		this.lineTo(this.path.vertexes[0]);
		return this;
	}
}

interface CornerOptions {
	cornerStyleName:CornerStyleName;
	cornerRadius:number;
}
const fullTurnAngle = Math.PI*2;
const quarterTurn = Math.PI/2;
const eighthTurnAngle = Math.PI/4;

interface BoxOptions {
	cx?:number;
	cy?:number;
	x0?:number;
	y0?:number;
	width:number;
	height:number;
	cornerOptions:CornerOptions;
}

function figureEdge(x0:number|undefined, cx:number|undefined, width:number, varName:string):number {
	if( x0 != undefined ) return x0;
	if( cx != undefined ) return cx - width/2;
	throw new Error("Either '"+varName+"0' or 'c"+varName+"' must be specified for box");
}

function boxPath(boxOptions:BoxOptions) {
	const w = boxOptions.width;
	const h = boxOptions.height;
	const x0 = figureEdge(boxOptions.x0, boxOptions.cx, boxOptions.width, "x");
	const y0 = figureEdge(boxOptions.y0, boxOptions.cy, boxOptions.height, "y");
	const c = boxOptions.cornerOptions.cornerRadius;
	const cs = boxOptions.cornerOptions.cornerStyleName;
	let pb = new PathBuilder({x:x0+c, y:y0+0, z:0});
	pb.lineToCornerStart({x:x0+w,y:y0+0,z:0}, quarterTurn, c);
	pb.turn(quarterTurn, c, cs);
	pb.lineToCornerStart({x:x0+w,y:y0+h,z:0}, quarterTurn, c);
	pb.turn(quarterTurn, c, cs);
	pb.lineToCornerStart({x:x0+0,y:y0+h,z:0}, quarterTurn, c);
	pb.turn(quarterTurn, c, cs);
	pb.lineToCornerStart({x:x0+0,y:y0+0,z:0}, quarterTurn, c);
	pb.turn(quarterTurn, c, cs);
	return pb.closeLoop().path;
}

function circlePath(radius:number):Path {
	let pb = new PathBuilder({x:0, y:-radius, z:0});
	return pb.turn(fullTurnAngle, radius).closeLoop().path;
}

//// Shape2D

interface TransformShape {
	typeName:"TransformShape";
	transformation:TransformationMatrix3D;
	subShape:Shape;
}
interface MultiShape {
	typeName:"MultiShape";
	subShapes:Shape[];
}
interface Points {
	typeName:"Points"
	positions:Vector3D[];
}
interface RoundHoles {
	typeName:"RoundHoles";
	positions:Vector3D[];
	diameter:number;
}
type Shape = TransformShape|MultiShape|Path|RoundHoles|Points;

//// Text

interface TextBoundingBox {
	leftX:number;
	rightX:number;
	topX:number;
	bottomX:number;
}

interface TextCharacter {
	box: TextBoundingBox;
	shape: Shape;
}

interface Font {
	characters: {[char:string]: TextCharacter};
}

const blockLetterBoundingBox:TextBoundingBox = {
	leftX: -0.5, rightX: 0.5,
	topX: 0.5, bottomX: -0.5,
}

const togBlockLetters:Font = (() => {
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
		cx:0, cy:0, width: 1, height: 1, cornerOptions: {
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
		let paths:Path[] = [];
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
			paths.push({
				typeName:"Path",
				vertexes:blockVertexes,
				segments
			});
		}
		return {
			box: blockLetterBoundingBox,
			shape: {
				typeName: "MultiShape",
				subShapes: paths
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

const togLineLetters:Font = (() => {
	const vertexes:Vector3D[] = [];
	for( let y=0; y<5; ++y ) {
		for( let x=0; x<5; ++x ) {
			vertexes.push({x: (x+1)/6 - 0.5, y: 0.5 - (y+1)/6, z:0});
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
		let shapes:Shape[] = [];
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
			shapes.push({
				typeName:"Path",
				vertexes,
				segments
			});
		}
		if( points.length > 0 ) {
			shapes.push({
				typeName: "Points",
				positions: points
			})
		}
		return {
			box: blockLetterBoundingBox,
			shape: {
				typeName: "MultiShape",
				subShapes: shapes
			}
		}
	}
	// Priotity letters:
	// "TTSGCG"
	// "WSITEM-[0..9]"
	// "HEAT", "FAN", "AC", "COMM"
	// ACEFGHIMNOSTW
	return {
		characters: {
			"A": mkblok([[ea,ac,ec],[bc,bd]]),
			"B": mkblok([[aa,ea,ed,[cleft,cd],cd,[cleft,bd], ad,aa],[ca,cd]]),
			"C": mkblok([[ae,ac,[cleft,cc],ec,ee]]),
			"E": mkblok([[ae,aa,ea,ee],[ca,ce]]),
			"F": mkblok([[ae,aa,ea],[ca,ce]]),
			"G": mkblok([[ae,ac,[cleft,cc],ec,ee,ce,cc]]),
			"H": mkblok([[aa,ea],[ca,ce],[ae,ee]]),
			"I": mkblok([[aa,ae],[ac,ec],[ea,ee]]),
			"J": mkblok([[aa,ae],[ca,[cleft,cc],ce,ae]]),
			"M": mkblok([[ea,aa,cc,ae,ee]]),
			"N": mkblok([[ea,aa,ee,ae]]),
			"O": mkblok([[ac,[cleft,cc],ac]]),
			"S": mkblok([[ae,ab,[cleft,bb],cb,cd,[cright,dd],ed,ea]]),
			"T": mkblok([[aa,ae],[ac,ec]]),
			"-": mkblok([[ca,ce]]),
			"0": mkblok([[ac,[cleft,cc],ac],[cc]]),
			"1": mkblok([[ba,ac,ec],[ea,ee]]),
			"2": mkblok([[aa,ad,[cright,bd],cd,cc,[cleft,ec],ea,ee]]),
			"3": mkblok([[aa,ad,[cright,bd],cd,[cright,dd],ed,ea],[ca,cd]]),
			"4": mkblok([[ed,ad,ca,ce]]),
			"5": mkblok([[ae,aa,ca,cd,[cright,dd],ed,ea]]),
		}
	}
})();

function getFont(name:string):Font {
	switch(name) {
	case "tog-block-letters": return togBlockLetters;
	case "tog-line-letters": return togLineLetters;
	default:
		throw new Error("No such font: "+name);
	}
}

function textToShape(text:string, charset:Font):Shape {
	let x = 0;
	let chars:TextCharacter[] = [];
	for( let i=0; i<text.length; ++i ) {
		let charKey = text.charAt(i);
		let char = charset.characters[charKey];
		if( char != undefined ) {
			chars.push(char);
		}
	}
	let right = 0;
	let subShapes:Shape[] = [];
	for( let c in chars ) {
		let char = chars[c];
		let charWidth = char.box.rightX - char.box.leftX;
		subShapes.push({
			typeName: "TransformShape",
			transformation: vectormath.translationToTransform({x: right - char.box.leftX, y: 0, z:0}),
			subShape: char.shape
		});
		right += charWidth;
	}
	return {
		typeName: "MultiShape",
		subShapes
	}
}

////

interface DistanceUnit {
	gCode : string;
	unitValueInMm : number;
	names : string[];
};

const INCH : DistanceUnit = {
	gCode:"G20",
	unitValueInMm:2.54,
	names: ["inch", "in", '"', "inch", "inches"],
};

const MM : DistanceUnit = {
	gCode:"G21",
	unitValueInMm:1,
	names: ["millimeter", "mm", "millimeters"],
};

const distanceUnits:{[k:string]:DistanceUnit} = {
	"in": INCH,
	"millimeter": MM,
}

function getDistanceUnit(name:string):DistanceUnit {
	for( let du in distanceUnits ) {
		let distanceUnit = distanceUnits[du];
		for( let a in distanceUnit.names ) {
			if( distanceUnit.names[a] == name ) return distanceUnit;
		}
	}
	throw new Error("No such distance unit as '"+name+"'");
}

/** Carve 2D shapes at a single depth */
interface PathCarveTask
{
	typeName:"PathCarveTask";
	shapes:Shape[];
	depth:number;
}

type Task = PathCarveTask;

/**
 * A job is a bunch of stuff that the machine should be able to do all at once.
 * Different jobs may require bit changes or other setup.
 */
interface Job
{
	name:string;
	bit:RouterBit;
	offset:Vector3D;
	tasks:Task[];
}

function assertUnreachable(n:never) {
	throw new Error("Shouldn't've made it here");
}

interface RouterBit {
	name:string;
	diameterFunction:(depth:number)=>number;
}

abstract class ShapeProcessorBase {
	protected transformation:TransformationMatrix3D = vectormath.createIdentityTransform();
	protected transformVector(vec:Vector3D):Vector3D {
		return vectormath.transformVector(this.transformation, vec);
	}
	withTransform(xf:TransformationMatrix3D, callback:()=>void) {
		let oldTransform = this.transformation;
		this.transformation = vectormath.multiplyTransform(oldTransform, xf);
		callback();
		this.transformation = oldTransform;
	}
	forEachOffset(offsets:Vector3D[], callback:()=>void ) {
		let oldTransform = this.transformation;
		for( let o in offsets ) {
			this.transformation = vectormath.multiplyTransform(oldTransform, vectormath.translationToTransform(offsets[o]));
			callback();
		}
		this.transformation = oldTransform;
	}
}

class BoundsFinder extends ShapeProcessorBase {
	public minX:number = Infinity;
	public minY:number = Infinity;
	public minZ:number = Infinity;
	public maxX:number = -Infinity;
	public maxY:number = -Infinity;
	public maxZ:number = -Infinity;

	processPoint(p:Vector3D):void {
		this.minX = Math.min(this.minX, p.x);
		this.minY = Math.min(this.minY, p.y);
		this.minZ = Math.min(this.minZ, p.z);
		this.maxX = Math.max(this.maxX, p.x);
		this.maxY = Math.max(this.maxY, p.y);
		this.maxZ = Math.max(this.maxZ, p.z);
	}
	processPath(path:Path):void {
		for( let s in path.segments ) {
			let seg = path.segments[s];
			this.processPoint(this.transformVector(path.vertexes[seg.startVertexIndex]));
			this.processPoint(this.transformVector(path.vertexes[seg.endVertexIndex]));
		}
	}
	processHoles(positions:Vector3D[], diameter:number) {
		for( let p in positions ) {
			this.processPoint(this.transformVector(positions[p]));
		}
	}

	processShape(shape:Shape, depth:number) {
		switch(shape.typeName) {
		case "MultiShape":
			for( let s in shape.subShapes ) {
				this.processShape(shape.subShapes[s], depth);
			}
			return;
		case "TransformShape":
			return this.withTransform(shape.transformation, () => {
				this.processShape(shape.subShape, depth);
			});
		case "Path":
			return this.processPath(shape);
		case "Points":
			this.processHoles(shape.positions, 0);
			break;
		case "RoundHoles":
			this.processHoles(shape.positions, shape.diameter);
			return;
		}
	}

	processTask(task:Task) {
		switch(task.typeName) {
		case "PathCarveTask":
			for( let s in task.shapes ) this.processShape(task.shapes[s], task.depth);
			break;
		}
	}

	processJob(job:Job) {
		for( let t in job.tasks ) {
			this.withTransform(vectormath.translationToTransform(job.offset), () => {
				this.processTask(job.tasks[t]);
			});
		}
	}
}

class GCodeGenerator extends ShapeProcessorBase {
	public emitter:(s:string)=>string;
	public unit:DistanceUnit;
	public zoomHeight:number = 1/4;
	public minimumFastZ:number = 1/16;
	public stepDown:number = 0.02;
	public fractionDigits:number = 4;
	public commentMode:"None"|"Parentheses"|"Semicolon" = "Parentheses";
	protected _position = {x:0, y:0, z:0};
	protected currentBit:RouterBit;
	constructor() {
		super();
		this.emitter = console.log.bind(console);
		this.unit = INCH;
	}
	emit(line:string):void {
		this.emitter(line);
	}
	emitBlankLine():void {
		this.emit("");
	}
	emitComment(c:string):void {
		switch(this.commentMode) {
		case "None": return;
		case "Parentheses": return this.emit("("+c+")");
		case "Semicolon": return this.emit("; "+c);
		}
	}
	emitBlock(lines:string[]):void {
		for(let l in lines) this.emitter(lines[l]);
	}
	protected updatePosition(x:number|undefined, y:number|undefined, z:number|undefined):void {
		this._position = {
			x: x == undefined ? this._position.x : x,
			y: y == undefined ? this._position.y : y,
			z: z == undefined ? this._position.z : z,
		};
	}
	doMove(command:string, x:number|undefined, y:number|undefined, z:number|undefined=undefined) {
		if( x == undefined && y == undefined && z == undefined ) {
			this.emitComment("doMove with no x, y, or z!");
			return;
		}
		let line = command;
		if( x != undefined ) line += " X"+x.toFixed(this.fractionDigits);
		if( y != undefined ) line += " Y"+y.toFixed(this.fractionDigits);
		if( z != undefined ) line += " Z"+z.toFixed(this.fractionDigits);
		this.emit(line)
		this.updatePosition(x,y,z);
	}
	g00(x:number|undefined, y:number|undefined, z:number|undefined=undefined) {
		this.doMove("G00", x, y, z);
	}
	g01(x:number|undefined, y:number|undefined, z:number|undefined=undefined) {
		this.doMove("G01", x, y, z);
	}
	doCurve(command:string, x:number|undefined, y:number|undefined, z:number|undefined, i:number, j:number, k:number) {
		if( x == undefined && y == undefined && z == undefined ) {
			this.emitComment("doCurve with no x, y, or z!");
			return;
		}
		let line = command;
		line += " I"+i.toFixed(this.fractionDigits);
		line += " J"+j.toFixed(this.fractionDigits);
		line += " K"+k.toFixed(this.fractionDigits);
		if( x != undefined ) line += " X"+x.toFixed(this.fractionDigits);
		if( y != undefined ) line += " Y"+y.toFixed(this.fractionDigits);
		if( z != undefined ) line += " Z"+z.toFixed(this.fractionDigits);
		this.emit(line);
		this.updatePosition(x,y,z);
	}
	g02(x:number|undefined, y:number|undefined, z:number|undefined, i:number, j:number, k:number) {
		this.doCurve("G02",x,y,z,i,j,k);
	}
	g03(x:number|undefined, y:number|undefined, z:number|undefined, i:number, j:number, k:number) {
		this.doCurve("G03",x,y,z,i,j,k);
	}
	emitSetupCode():void {
		this.emit("G90");
		this.emit("G20");
		this.emit("F3");
		this.emit("S1000");
		this.emit("M03");
		this.zoomToZoomHeight();
		this.emitBlankLine();
	}
	emitShutdownCode():void {
		this.emitBlankLine();
		this.emitComment("Job done!");
		this.zoomToZoomHeight();
		this.emit("M05");
	}
	zoomToZoomHeight():void {
		this.g00(undefined, undefined, this.zoomHeight);
	}
	zoomTo(position:Vector3D):void {
		this.zoomToZoomHeight();
		position = this.transformVector(position);
		this.g00(position.x, position.y);
		let minZoomZ = Math.max(this.minimumFastZ, position.z);
		this.g00(undefined, undefined, minZoomZ);
		if( minZoomZ != position.z ) {
			this.g01(undefined, undefined, position.z);
		}
	}
	carvePathSegment(path:Path, segmentIndex:number, direction:number):void {
		let segment = path.segments[segmentIndex];
		let startVertexIndex:number;
		let endVertexIndex:number;
		if( direction > 0 ) {
			startVertexIndex = segment.startVertexIndex;
			endVertexIndex   = segment.endVertexIndex;
		} else {
			startVertexIndex = segment.endVertexIndex;
			endVertexIndex   = segment.startVertexIndex;
		}
		let startVertex = this.transformVector(path.vertexes[startVertexIndex]);
		// TODO: Check that startVertex is where we already are???
		let endVertex = this.transformVector(path.vertexes[endVertexIndex]);
		// Theoretically path vertexes could have depth.  I'm ignoring that for now.
		if(segment.typeName == "StraightPathSegment") {
			this.g01(endVertex.x, endVertex.y);
		} else {
			let axisVertexIndex = segment.axisVertexIndex;
			if( axisVertexIndex == undefined ) {
				throw new Error("Undefined curve center vertex on path segment "+segmentIndex);
			}
			let curveCenterVertex = this.transformVector(path.vertexes[axisVertexIndex]);
			let i = curveCenterVertex.x - startVertex.x;
			let j = curveCenterVertex.y - startVertex.y;
			let k = curveCenterVertex.z - startVertex.z;
			let angle = direction * (segment.typeName == "CounterClockwisePathSegment" ? 1 : -1)
			this.doCurve(angle > 0 ? "G03" : "G02", endVertex.x, endVertex.y, undefined, i, j, k);
		}
	}
	carvePath(path:Path, depth:number):void {
		if(path.segments.length == 0) return;
		if(depth <= 0) return;

		let targetZ = 0 - depth;
		let seg0 = path.segments[0];
		let startPoint = path.vertexes[seg0.startVertexIndex];
		this.zoomTo(startPoint);
		let currentZ = 0;
		let direction = 1;
		while( currentZ > targetZ ) {
			currentZ = Math.max(targetZ, currentZ - this.stepDown);
			this.emitComment("Step down to "+currentZ.toFixed(this.fractionDigits));
			this.g01(undefined, undefined, currentZ);
			let startPosition = this._position;
			let ssi0:number, ssi1:number, ssii:number;
			if( direction > 0 ) {
				ssi0 = 0;
				ssi1 = path.segments.length-1;
				ssii = 1; 
			} else {
				ssi0 = path.segments.length-1;
				ssi1 = 0;
				ssii = -1; 
			}
			for( let i=ssi0; ; i += ssii ) {
				this.carvePathSegment(path, i, direction);
				if( i == ssi1 ) break;
			}
			if( !vectormath.vectorsAreEqual(this._position, startPosition) ) {
				// Unless it's a loop, reverse for the next step!
				this.emitComment("Reversing because "+vectorToString(this._position)+" != "+vectorToString(startPosition));
				direction = -direction;
			} else {
				this.emitComment("Path closed!")
			}
		}
		this.zoomToZoomHeight();
	}
	carveHoles(positions:Vector3D[], diameter:number, depth:number) {
		let circleRadius = diameter/2 - this.currentBit.diameterFunction(0)/2;
		if( circleRadius <= 0 ) {
			this.emitComment(diameter + this.unit.names[1] + " hole will be a banger");
			for( let p in positions ) {
				this.zoomTo(positions[p]);
				this.bangHole(depth, this.stepDown, this.stepDown/2);
			}
		} else {
			this.emitComment(diameter + this.unit.names[1] + " hole will be circles");
			const path = circlePath(circleRadius);
			this.forEachOffset(positions, () => {
				this.carvePath(path, depth);
			})
		}
	}
	carveShape(shape:Shape, depth:number) {
		switch(shape.typeName) {
		case "MultiShape":
			for( let s in shape.subShapes ) {
				this.carveShape(shape.subShapes[s], depth);
			}
			return;
		case "TransformShape":
			return this.withTransform(shape.transformation, () => {
				this.carveShape(shape.subShape, depth);
			});
		case "Path":
			return this.carvePath(shape, depth);
		case "Points":
			return this.carveHoles(shape.positions, 0, depth);
		case "RoundHoles":
			return this.carveHoles(shape.positions, shape.diameter, depth);
		}
		assertUnreachable(shape);
	}
	doPathCarveTask(task:PathCarveTask) {
		for( let p in task.shapes ) {
			this.carveShape(task.shapes[p], task.depth);
		}
	}
	bangHole(depth:number, stepDown:number, stepUp:number) {
		let currentZ = 0;
		let targetZ = 0 - depth;
		this.g01(undefined, undefined, currentZ); // If it's not already at the surface
		while( currentZ > targetZ ) {
			currentZ -= stepDown;
			this.g01(undefined, undefined, currentZ);
			this.g01(undefined, undefined, currentZ + stepUp);
		}
		this.g01(undefined, undefined, 0);
	}
	processTask(task:Task) {
		switch(task.typeName) {
		case "PathCarveTask": return this.doPathCarveTask(task);
		}
	}
	processJob(job:Job):void {
		this.currentBit = job.bit;
		this.emitBlankLine();
		this.emitComment("Job: "+job.name);
		this.withTransform(vectormath.translationToTransform(job.offset), () => {
			for( let p in job.tasks ) {
				this.processTask(job.tasks[p]);
			}
		});
	}
}

function htmlEscape(text:string) {
	return text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#039;");
}

class SVGGenerator extends ShapeProcessorBase {
	public emitter:(s:string)=>string;
	protected bottomColor = "black";
	protected cutColor = "gray";

	// Updated as jobs/tasks are processed
	protected routerBit:RouterBit;
	protected strokeColor = "purple";
	protected strokeWidth:number = 0;

	constructor() {
		super();
		this.emitter = console.log.bind(console);
	}

	openElement(name:string, attrs:{[k:string]: string|number}={}, close:boolean=false) {
		this.emitter("<"+name);
		for( let k in attrs ) {
			let v = attrs[k];
			this.emitter(" "+k+"=\""+htmlEscape(""+v)+"\"");
		}
		if( close ) this.emitter("/>\n");
		else this.emitter(">");
	}
	closeElement(name:string) {
		this.emitter("</"+name+">");
	}

	emitPath(path:Path) {
		let dParts:string[] = [];
		let started = false;
		let prevVertexIndex:number|undefined = undefined;
		for( let s in path.segments ) {
			let seg = path.segments[s];
			let startVertex = this.transformVector(path.vertexes[seg.startVertexIndex]);
			let endVertex = this.transformVector(path.vertexes[seg.endVertexIndex]);
			if( prevVertexIndex != seg.startVertexIndex ) {
				dParts.push("M"+startVertex.x+","+startVertex.y);
			}
			switch( seg.typeName ) {
			case "StraightPathSegment":
				dParts.push("L"+endVertex.x+","+endVertex.y);
				break;
			case "ClockwisePathSegment": case "CounterClockwisePathSegment":
				let axisVertex = this.transformVector(path.vertexes[seg.axisVertexIndex]);
				let axisDx = axisVertex.x - startVertex.x;
				let axisDy = axisVertex.y - startVertex.y;
				let radius = Math.sqrt(axisDx*axisDx + axisDy*axisDy);
				// TODO: Need to take transformation into account to determine if it's clockwise or counterclockwise
				dParts.push("A"+radius+","+radius+" 0 0 "+(seg.typeName == "ClockwisePathSegment" ? "0" : "1")+" "+endVertex.x+","+endVertex.y);
				break;
			}
			prevVertexIndex = seg.endVertexIndex;
		}
		this.openElement("path", {"fill": "none", "stroke-linecap": "round", "stroke-linejoin": "round", "stroke": this.strokeColor, "stroke-width": this.strokeWidth, "d": dParts.join(" ")}, true);
	}

	emitHoles(positions:Vector3D[], diameter:number) {
		let fill:string;
		let stroke:string;
		const tipWidth = this.routerBit.diameterFunction(0);
		const extraDiam = this.strokeWidth - tipWidth;
		const bottomDiameter = Math.max(diameter, tipWidth);
		const circleRadius = (bottomDiameter + extraDiam)/2;
		for( let p in positions ) {
			let xfPos = this.transformVector(positions[p]);
			this.openElement("circle", {
				cx: xfPos.x, cy: xfPos.y,
				r: circleRadius,
				fill: this.strokeColor,
				"stroke-width": 0,
			}, true);
		}
	}

	processShape(shape:Shape) {
		switch(shape.typeName) {
		case "MultiShape":
			for( let s in shape.subShapes ) {
				this.processShape(shape.subShapes[s]);
			}
			return;
		case "TransformShape":
			return this.withTransform(shape.transformation, () => {
				this.processShape(shape.subShape);
			});
		case "Path":
			return this.emitPath(shape);
		case "Points":
			this.emitHoles(shape.positions, 0);
			break;
		case "RoundHoles":
			this.emitHoles(shape.positions, shape.diameter);
			return;// this.emitCircles(shape.positions, shape.diameter);
		}
	}

	processTask(task:Task) {
		switch(task.typeName) {
		case "PathCarveTask":
			const cutTopWidth    = this.routerBit.diameterFunction(task.depth);
			const cutBottomWidth = this.routerBit.diameterFunction(0);
			if( cutTopWidth > cutBottomWidth ) {
				this.strokeWidth = cutTopWidth;
				this.strokeColor = this.cutColor;
				for( let s in task.shapes ) this.processShape(task.shapes[s]);
			}
			this.strokeWidth = cutBottomWidth;
			this.strokeColor = this.bottomColor;
			for( let s in task.shapes ) this.processShape(task.shapes[s]);
			break;
		}
	}

	processJob(job:Job):void {
		this.routerBit = job.bit;
		this.withTransform(vectormath.translationToTransform(job.offset), () => {
			for( let t in job.tasks ) {
				this.processTask(job.tasks[t]);
			}
		});
	}

	emitHeader(modelBounds:{minX:number,minY:number,maxX:number,maxY:number}):void {
		const modelWidth = modelBounds.maxX - modelBounds.minX;
		const modelHeight = modelBounds.maxY - modelBounds.minY;
		this.emitter('<?xml version="1.0" standalone="no"?>\n');
		this.openElement("svg", {
			xmlns:"http://www.w3.org/2000/svg", version:"1.1",
			style: "width: "+modelWidth+"in; height: "+modelHeight+"in",
			viewBox:modelBounds.minX+" "+modelBounds.minY+" "+modelWidth+" "+modelHeight,
			transform:"scale(1,-1)"
		});
	}

	emitFooter():void {
		this.emitter("</svg>\n");
	}
}

type PanelAxis = "x"|"y";
type LatOrLong = "longitudinal"|"lateral";

interface TOGPanelOptions {
	length: number; // Width in inches
	cornerStyle: CornerStyleName;
	outlineDepth: number;
	holeDiameter: number;
	holeDepth: number;
	holeSpacing: number;
	label: string|undefined;
	labelFontName: string;
	labelDepth: number;
	labelScale: number;
	labelDirection: LatOrLong;
}

function makeTogPanelTasks(options:TOGPanelOptions):Task[] {
	let holeX = 0.25;
	const labelFont = getFont(options.labelFontName);
	let holePositions = [];
	let firstHoleX = 0.25;
	let lastHoleX = options.length - 0.25;
	for( let x = firstHoleX; x <= lastHoleX; x += options.holeSpacing ) {
		holePositions.push({x, y:0.25, z:0});
	}
	for( let x = lastHoleX; x >= firstHoleX; x -= options.holeSpacing ) {
		holePositions.push({x, y:3.25, z:0});
	}
	let label = options.label || "";
	let labelShape = textToShape(label, labelFont);
	let tasks:Task[] = [];
	if( label.length > 0 && options.labelDepth > 0 ) {
		let textPlacementTransform:TransformationMatrix3D;
		if( options.labelDirection == "longitudinal" ) {
			textPlacementTransform = vectormath.translationToTransform({x:0.25, y:3 - options.labelScale/2, z:0});
		} else {
			textPlacementTransform = vectormath.multiplyTransform(
				vectormath.translationToTransform({x:options.length/2, y:0.5, z:0}),
				vectormath.xyzAxisAngleToTransform(0, 0, 1, quarterTurn)
			);
		}

		tasks.push({
			typeName: "PathCarveTask",
			depth: options.labelDepth,
			shapes: [
				{
					typeName: "TransformShape",
					transformation: vectormath.multiplyTransform(
						textPlacementTransform,
						vectormath.scaleToTransform(options.labelScale),
					),
					subShape: labelShape
				}
			]
		});
	}
	if( options.holeDepth > 0 ) {
		tasks.push({
			typeName: "PathCarveTask",
			depth: options.holeDepth,
			shapes: [
				{
					typeName: "RoundHoles",
					diameter: options.holeDiameter,
					positions: holePositions
				}
			]
		});
	}
	if( options.outlineDepth > 0 ) {
		tasks.push({
			typeName: "PathCarveTask",
			depth: options.outlineDepth,
			shapes: [
				boxPath({
					x0: 0, y0: 0,
					width: options.length, height: 3.5,
					cornerOptions: { cornerRadius: 0.25, cornerStyleName: "Round" },
				})
			]
		});
	}
	return tasks;
}

const parseableNumberRegex = /^([+-]?\d+(?:\.\d+)?)(?:\/(\d+))?/;

function parseNumber(numStr:string):number {
	let m = parseableNumberRegex.exec(numStr);
	if( m == null ) {
		throw new Error("Failed to parse '"+numStr+"' as number");
	}
	let num = m[1];
	let den = m[2];
	if( den == null ) den = "1";
	return +num / +den;
}

const numberWithUnitRegex =  /^([+-]?\d+(?:\.\d+)?(?:\/(\d+))?)(\D.*)$/;

function parseDistance(str:string):number {
	let m = numberWithUnitRegex.exec(str);
	if( m == null ) {
		throw new Error("Failed to parse '"+str+"' as distance; maybe you need tot add units?")
	}
	let v = parseNumber(m[1]+m[2]);
	let u = getDistanceUnit(m[3]);
	if( u == INCH ) return v;
	return v * u.unitValueInMm / 25.4;
}

function makeVBit(degrees:number, pointSize:number):RouterBit {
	const twiceSlope = Math.tan(degrees/2 * Math.PI/180);
	return {
		name: (pointSize > 0 ? pointSize + "in-tip " : "") + degrees+"-degree carving bit",
		diameterFunction: (depth) => pointSize + depth*twiceSlope,
	}
}

function transformShape(xf:TransformationMatrix3D, shape:Shape):Shape {
	return {
		typeName: "TransformShape",
		transformation: xf,
		subShape: shape
	}
}

function shapeMmToInch(shape:Shape):Shape {
	return transformShape(vectormath.scaleToTransform(1/25.4), shape)
}

function translateShape(shape:Shape, offset:Vector3D):Shape {
	return transformShape(vectormath.translationToTransform(offset), shape)
}

// Parts for router:
// WSTYPE-200027 = over thingy
// WSTYPE-200028 = under thingy
// WSTYPE-200029 = ???
function makePart200027Tasks():Task[] {
	// 1cm wide
	// 40cm tall
	// stickey outey part (1.5cm wide) in middle 2cm
	// Center line would be at y = 2dm
	const panelThickness = 1/8; // inches
	const mountingHoleSpacing = 9.5; // mm
	let pb:PathBuilder = new PathBuilder({x:0,y:0,z:0});
	pb.lineTo({x:10,y: 0,z:0}).lineTo({x:10,y: 0,z:0}).lineTo({x:10,y:10,z:0})
	  .lineTo({x:15,y:10,z:0}).lineTo({x:15,y:30,z:0}).lineTo({x:10,y:30,z:0})
	  .lineTo({x:10,y:40,z:0}).lineTo({x: 0,y:40,z:0}).closeLoop();
	let pokeyHolePositions:Vector3D[] = [];
	for( let phRow=0; phRow<=1; ++phRow ) {
		for( let phX=1.5; phX<15; phX += 2 ) {
			pokeyHolePositions.push({x:phX, y:20+(phRow-0.5)*mountingHoleSpacing, z:0})
		}
	}
	return [
		{
			typeName: "PathCarveTask",
			depth: 1/25.4,
			shapes: [
				shapeMmToInch({
					typeName: "Points",
					positions: pokeyHolePositions
				}),
			]
		},
		{
			typeName: "PathCarveTask",
			depth: panelThickness,
			shapes: [shapeMmToInch(pb.path)]
		}
	];
}

function makePart200028Tasks():Task[] {
	const panelThickness = 1/8;
	const panelWidth = 20 / 25.4;
	const panelLength = 30 / 25.4;
	const mountingHoleSpacing = 9.5 / 25.4;
	let pokeyHolePositions:Vector3D[] = [];
	for( let phRow=0; phRow<=1; ++phRow ) {
		for( let phY=2; phY < panelLength * 25.4; phY += 2) {
			pokeyHolePositions.push({x:panelWidth/2 + (phRow-0.5)*mountingHoleSpacing, y:phY / 25.4, z:0})
		}
	}
	return [
		{
			typeName: "PathCarveTask",
			depth: 1/25.4,
			shapes: [
				{
					typeName: "Points",
					positions: pokeyHolePositions
				},
			]
		},
		{
			typeName: "PathCarveTask",
			depth: panelThickness,
			shapes: [
				boxPath({
					cx: panelWidth/2,
					cy: panelLength/2,
					width: 8 / 25.4,
					height: panelLength - 10 / 25.4,
					cornerOptions: {
						cornerRadius: 4 / 25.4,
						cornerStyleName: "Round"
					}
				}),
				boxPath({
					x0: 0, y0: 0,
					width: panelWidth,
					height: panelLength,
					cornerOptions: {
						cornerRadius: 1/8,
						cornerStyleName: "Round"
					}
				})
			]
		}
	];
}

interface JobProcessor {
	processJob(job:Job):void;
}

function processJobs(processor:JobProcessor, jobs:Job[]) {
	for( let j in jobs ) processor.processJob(jobs[j]);
}

if( require.main == module ) {
	let jobs:Job[] = [];
	let label = "TTSGCG";
	let labelFontName = "tog-block-letters";
	let bitTipSize = 0.05;
	let bitAngle = 30;
	let holeDepth = 1/8;
	let holeDiameter = 5/32;
	let labelDepth = 1/32;
	let holeSpacing = 1/4; // Usually 1/2 is sufficient but why not do even better?!
	let labelScale = 2.5/6; // Fits "TTSGCG" into 2.5 inches :P
	let outlineDepth = 1/16;
	let length = 1;
	let labelDirection:LatOrLong = "lateral";
	let outputMode:"svg"|"gcode"|"bounds" = "gcode";
	let padding:number = 0.5;
	let offset:Vector3D = {x:0, y:0, z:0};

	const makeBit = function() {
		return makeVBit(bitAngle, bitTipSize);
	}

	const empty = function(s:string|undefined):boolean {
		return s == undefined || s.length == 0;
	}

	for( let i=2; i<process.argv.length; ++i ) {
		let m;
		let arg = process.argv[i];
		if( arg == "--no-outline" ) {
			outlineDepth = 0;
		} else if( (m = /^--outline-depth=(.*)$/.exec(arg)) ) {
			outlineDepth = +m[1];
		} else if( arg == "--no-holes" ) {
			holeDepth = 0;
		} else if( arg == '--holes-only' ) {
			labelDepth = 0;
			outlineDepth = 0;
		} else if( arg == '--outline-only' ) {
			labelDepth = 0;
			holeDepth = 0;
		} else if( arg == '--label-only' ) {
			outlineDepth = 0;
			holeDepth = 0;
		} else if( (m = /^--offset=([^,]*),([^,]*),([^,]*)$/.exec(arg)) ) {
			offset = {x:offset.x, y:offset.y, z:offset.z};
			if( !empty(m[1]) ) offset.x = parseDistance(m[1]);
			if( !empty(m[2]) ) offset.y = parseDistance(m[2]);
			if( !empty(m[3]) ) offset.z = parseDistance(m[3]);
		} else if( (m = /^--hole-depth=(.*)$/.exec(arg)) ) {
			holeDepth = +m[1];
		} else if( (m = /^--label=(.*)$/.exec(arg)) ) {
			label = m[1];
		} else if( (m = /^--label-font=(.*)$/.exec(arg)) ) {
			labelFontName = m[1];
		} else if( (m = /^--label-direction=(longitudinal|lateral)$/.exec(arg)) ) {
			labelDirection = <LatOrLong>m[1];
		} else if( (m = /^--bit-diameter=(.+)$/.exec(arg)) ) {
			bitTipSize = parseNumber(m[1]);
		} else if( (m = /^--padding=(.*)$/.exec(arg)) ) {
			padding = parseNumber(m[1]);
		} else if( arg == "--output-bounds" ) {
			outputMode = "bounds";
		} else if( arg == "--output-gcode" ) {
			outputMode = "gcode";
		} else if( arg == "--output-svg" ) {
			outputMode = "svg";
		} else if( arg == '--tog-panel' ) {
			jobs.push({
				name: "TOGPanel",
				offset,
				bit: makeBit(),
				tasks: makeTogPanelTasks({
					cornerStyle: "Round",
					holeDiameter,
					labelFontName,
					holeDepth,
					holeSpacing,
					outlineDepth,
					length,
					label,
					labelDepth,
					labelScale,
					labelDirection,
				})
			});
		} else if( arg == '--wstype-200027' ) {
			jobs.push({
				name: "WSTYPE-200027",
				offset,
				bit: makeBit(),
				tasks: makePart200027Tasks()
			});
		} else if( arg == '--wstype-200028' ) {
			jobs.push({
				name: "WSTYPE-200028",
				offset,
				bit: makeBit(),
				tasks: makePart200028Tasks()
			});
		} else {
			console.error("Unrecognized argument: "+arg);
			process.exit(1);
		}
	}


	let bf = new BoundsFinder();
	processJobs(bf, jobs);

	switch( outputMode ) {
	case "bounds":
		console.log("x: "+bf.minX +".."+bf.maxX);
		console.log("y: "+bf.minY +".."+bf.maxY);
		console.log("z: "+bf.minZ +".."+bf.maxZ);
		break;
	case "gcode":
		let gcg = new GCodeGenerator();
		gcg.commentMode = "None";
		gcg.emitSetupCode();
		processJobs(gcg, jobs);
		gcg.emitShutdownCode();
		break;
	case "svg":
		let padded = aabb.pad(bf, padding);
		let sg = new SVGGenerator();
		sg.emitHeader(padded);
		processJobs(sg, jobs);
		sg.emitFooter();
		break;
	}
}
