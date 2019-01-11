import * as vectormath from './vectormath';
import { TransformationMatrix3D, Vector3D } from './vectormath';

// Vector3D = {x:Number, y:Number, z:Number}
// StraightPathSegment = 
// PathSegment = StraightPathSegment|ArcPathSegment
// Path = { vertexes: Vector3D[], segments: PathSegment[] }

// 

interface GCodeUnit {
	name : string;
	gCode : string;
	unitValueInMm : number;
};

const INCH : GCodeUnit = {
	name:"inch",
	gCode:"G20",
	unitValueInMm:2.54
};

const MM : GCodeUnit = {
	name:"mm",
	gCode:"G21",
	unitValueInMm:1,
};

class GCodeGenerator {
	public bitRadius:number;
	public emitter:(s:string)=>string;
	public transform:TransformationMatrix3D;
	public unit:GCodeUnit;
	protected savedTransforms:TransformationMatrix3D[] = [];
	constructor() {
		this.bitRadius = 3;
		this.emitter = console.log.bind(console);
		this.transform = vectormath.createIdentityTransform();
		this.unit = INCH;
	}
	pushTransform(xf:TransformationMatrix3D):void {
		this.savedTransforms.push(this.transform);
		this.transform = vectormath.multiplyTransform(this.transform, xf);
	}
	popTransform():void {
		let popped = this.savedTransforms.pop();
		if( popped == undefined ) throw new Error("Tried to pop transform from empty stack!");
		this.transform = popped;
	}
	emit(line:string):void {
		this.emitter(line);
	}
	emitBlock(lines:string[]):void {
		for(let l in lines) this.emitter(lines[l]);
	}
	emitSetupCode():void {
		this.emit("G90");
		this.emit("G20")
	}
}

new GCodeGenerator().emitSetupCode();
