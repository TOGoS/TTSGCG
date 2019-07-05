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
	axisVertexIndex:number|undefined;
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
	width:number;
	height:number;
	cornerOptions:CornerOptions;
	centered:boolean;
}

function boxPath(boxOptions:BoxOptions) {
	const w = boxOptions.width;
	const h = boxOptions.height;
	let x0 = boxOptions.centered ? 0-w/2 : 0;
	let y0 = boxOptions.centered ? 0-h/2 : 0;
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
interface RoundHoles {
	typeName:"RoundHoles";
	positions:Vector3D[];
	diameter:number;
}
type Shape = TransformShape|MultiShape|Path|RoundHoles;

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

interface Charset {
	characters: {[char:string]: TextCharacter};
}

const togBlockLetters:Charset = (() => {
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
	const blockLetterBoundingBox:TextBoundingBox = {
		leftX: -0.5, rightX: 0.5,
		topX: 0.5, bottomX: -0.5,
	}
	const blockVertexes:Vector3D[] = [];
	const outlinePath:Path = boxPath({
		width: 1, height: 1, cornerOptions: {
			cornerRadius: 1/8,
			cornerStyleName: "Round"
		}, centered: true
	});
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

function textToShape(text:string, charset:Charset):Shape {
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
	name : string;
	gCode : string;
	unitValueInMm : number;
};

const INCH : DistanceUnit = {
	name:"inch",
	gCode:"G20",
	unitValueInMm:2.54
};

const MM : DistanceUnit = {
	name:"mm",
	gCode:"G21",
	unitValueInMm:1,
};

/** Carve 2D shapes at a single depth */
interface PathCarveTask
{
	typeName:"PathCarveTask";
	shapes:Shape[];
	depth:number;
}

/** @deprecated; just use RoundHole shapes instead */
interface HoleDrillTask
{
	typeName:"HoleDrillTask";
	positions:Vector3D[];
	diameter:number;
	depth:number;
}

type Task = PathCarveTask|HoleDrillTask;

/**
 * A job is a bunch of stuff that the machine should be able to do all at once.
 * Different jobs may require bit changes or other setup.
 */
interface Job
{
	name:string;
	offset:Vector3D;
	tasks:Task[];
}

function assertUnreachable(n:never) {
	throw new Error("Shouldn't've made it here");
}

class GCodeGenerator {
	public bitDiameter:number = 0.1;
	public emitter:(s:string)=>string;
	public transformation:TransformationMatrix3D;
	public unit:DistanceUnit;
	public zoomHeight:number = 1/4;
	public minimumFastZ:number = 1/16;
	public stepDown:number = 0.02;
	public fractionDigits:number = 4;
	public commentMode:"None"|"Parentheses"|"Semicolon" = "Parentheses";
	protected _position = {x:0, y:0, z:0};
	constructor() {
		this.emitter = console.log.bind(console);
		this.transformation = vectormath.createIdentityTransform();
		this.unit = INCH;
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
	protected transformVector(vec:Vector3D):Vector3D {
		return vectormath.transformVector(this.transformation, vec);
	}
	protected updatePosition(x:number|undefined, y:number|undefined, z:number|undefined):void {
		this._position = {
			x: x == undefined ? this._position.x : x,
			y: y == undefined ? this._position.y : y,
			z: z == undefined ? this._position.z : z,
		};
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
		let circleRadius = diameter/2 - this.bitDiameter/2;
		if( circleRadius <= 0 ) {
			this.emitComment(diameter + this.unit.name + " hole will be a banger");
			for( let p in positions ) {
				this.zoomTo(positions[p]);
				this.bangHole(depth, this.stepDown, this.stepDown/2);
			}
		} else {
			this.emitComment(diameter + this.unit.name + " hole will be circles");
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
	doHoleDrillTask(task:HoleDrillTask) {
		return this.carveHoles(task.positions, task.diameter, task.depth);
	}
	doTask(task:Task) {
		switch(task.typeName) {
		case "PathCarveTask": return this.doPathCarveTask(task);
		case "HoleDrillTask": return this.doHoleDrillTask(task);
		}
	}
	doJob(job:Job):void {
		this.emitBlankLine();
		this.emitComment("Job: "+job.name);
		this.withTransform(vectormath.translationToTransform(job.offset), () => {
			for( let p in job.tasks ) {
				this.doTask(job.tasks[p]);
			}
		});
	}
}

type PanelAxis = "x"|"y";
type LatOrLong = "longitudinal"|"lateral";

interface TOGPanelOptions {
	length: number; // Width in inches
	cornerStyle: CornerStyleName;
	outlineDepth: number;
	holeDepth: number;
	label: string|undefined;
	labelDepth: number;
	labelScale: number;
	labelDirection: LatOrLong;
}

function makeTogPanelTasks(options:TOGPanelOptions):Task[] {
	let holeX = 0.25;
	let holePositions = [];
	for( let x=0.25; x<options.length; x += 0.5 ) {
		holePositions.push({x, y:0.25, z:0});
	}
	for( let x=0.25; x<options.length; x += 0.5 ) {
		holePositions.push({x, y:3.25, z:0});
	}
	let label = options.label || "";
	let labelShape = textToShape(label, togBlockLetters);
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
					diameter: 5/32,
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
					width: options.length, height: 3.5,
					cornerOptions: { cornerRadius: 0.25, cornerStyleName: "Round" },
					centered: false
				})
			]
		});
	}
	return tasks;
}

if( require.main == module ) {
	let label = "TTSGCG";
	let holeDepth = 1/8;
	let labelDepth = 1/32;
	let labelScale = 2.5/6;
	let outlineDepth = 1/16;
	let length = 1;
	let labelDirection:LatOrLong = "lateral";
	for( let i=2; i<process.argv.length; ++i ) {
		let m;
		let arg = process.argv[i];
		if( arg == "--no-outline" ) {
			outlineDepth = 0;
		} else if( (m = /^--outline-depth=(.*)$/.exec(arg)) ) {
			outlineDepth = +m[1];
		} else if( arg == "--no-holes" ) {
			holeDepth = 0;
		} else if( (m = /^--hole-depth=(.*)$/.exec(arg)) ) {
			holeDepth = +m[1];
		} else if( (m = /^--label=(.*)$/.exec(arg)) ) {
			label = m[1];
		} else if( (m = /^--label-direction=(longitudinal|lateral)$/.exec(arg)) ) {
			labelDirection = <LatOrLong>m[1];
		} else {
			console.error("Unrecognized argument: "+arg);
			process.exit(1);
		}
	}

	let gcg = new GCodeGenerator();
	gcg.commentMode = "None";
	gcg.emitSetupCode();
	gcg.doJob({
		name: "TOGPanel",
		offset: {x:0, y:0, z:0},
		tasks: makeTogPanelTasks({
			cornerStyle: "Round",
			holeDepth,
			outlineDepth,
			length,
			label,
			labelDepth,
			labelScale,
			labelDirection,
		})
	});
	gcg.emitShutdownCode();
}
