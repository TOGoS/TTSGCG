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
}

function boxPath(boxOptions:BoxOptions) {
	const w = boxOptions.width;
	const h = boxOptions.height;
	const c = boxOptions.cornerOptions.cornerRadius;
	const cs = boxOptions.cornerOptions.cornerStyleName;
	let pb = new PathBuilder({x:c, y:0, z:0});
	pb.lineToCornerStart({x:w,y:0,z:0}, quarterTurn, c);
	pb.turn(quarterTurn, c, cs);
	pb.lineToCornerStart({x:w,y:h,z:0}, quarterTurn, c);
	pb.turn(quarterTurn, c, cs);
	pb.lineToCornerStart({x:0,y:h,z:0}, quarterTurn, c);
	pb.turn(quarterTurn, c, cs);
	pb.lineToCornerStart({x:0,y:0,z:0}, quarterTurn, c);
	pb.turn(quarterTurn, c, cs);
	return pb.closeLoop().path;
}

function centeredCirclePath(radius:number):Path {
	let pb = new PathBuilder({x:0, y:-radius, z:0});
	return pb.turn(fullTurnAngle, radius).closeLoop().path;
}

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

interface PathCarveTask
{
	typeName:"PathCarveTask";
	paths:Path[];
	depth:number;
}

interface HoleDrillTask
{
	typeName:"HoleDrillTask";
	positions:Vector3D[];
	diameter:number;
	depth:number;
}

type Task = PathCarveTask|HoleDrillTask;

interface Job
{
	name:string;
	offset:Vector3D;
	tasks:Task[];
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
		this.emit("("+c+")");
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
			this.doCurve(direction > 0 ? "G03" : "G02", endVertex.x, endVertex.y, undefined, i, j, k);
		}
	}
	carvePath(path:Path, depth:number):void {
		if(path.vertexes.length == 0) return;
		if(depth <= 0) return;

		let targetZ = 0 - depth;
		let startPoint = path.vertexes[0];
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
	doPathCarveTask(task:PathCarveTask) {
		for( let p in task.paths ) {
			this.carvePath(task.paths[p], task.depth);
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
		let circleRadius = task.diameter/2 - this.bitDiameter/2;
		if( circleRadius <= 0 ) {
			this.emitComment(task.diameter + this.unit.name + " hole will be a banger");
			for( let p in task.positions ) {
				this.zoomTo(task.positions[p]);
				this.bangHole(task.depth, this.stepDown, this.stepDown/2);
			}
		} else {
			this.emitComment(task.diameter + this.unit.name + " hole will be circles");
			const path = centeredCirclePath(circleRadius);
			this.forEachOffset(task.positions, () => {
				this.carvePath(path, task.depth);
			})
		}
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

interface TOGPanelOptions {
	width: number; // Width in inches
	cornerStyle: CornerStyleName;
	outlineDepth: number;
	holeDepth: number;
}

function makeTogPanelTasks(options:TOGPanelOptions):Task[] {
	let holeX = 0.25;
	let holePositions = [];
	for( let x=0.25; x<options.width; x += 0.5 ) {
		holePositions.push({x, y:0.25, z:0});
	}
	for( let x=0.25; x<options.width; x += 0.5 ) {
		holePositions.push({x, y:3.25, z:0});
	}
	return [
		{
			typeName: "PathCarveTask",
			depth: 1/16,
			paths: [
				boxPath({
					width: options.width, height: 3.5,
					cornerOptions: { cornerRadius: 0.25, cornerStyleName: "Round" }
				})
			]
		},
		{
			typeName: "HoleDrillTask",
			depth: options.holeDepth,
			diameter: 5/32,
			positions: holePositions
		}
	];
}

if( require.main == module ) {
	let gcg = new GCodeGenerator();
	gcg.emitSetupCode();
	gcg.doJob({
		name: "TOGPanel",
		offset: {x:0, y:0, z:0},
		tasks: makeTogPanelTasks({
			cornerStyle: "Round",
			holeDepth: 1/8,
			outlineDepth: 1/16,
			width: 2
		})
	});
	gcg.emitShutdownCode();
}
