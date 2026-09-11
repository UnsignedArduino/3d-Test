game.consoleOverlay.setVisible(true);
game.stats = true;

// all coordinates assume right handed y up
// todo: better name then "Testing3D"
namespace Testing3D {
    namespace LinearAlgebra {
        export function vectorsub(v1: number[], v2: number[]): number[] {
            const result = [];
            for (let i = 0; i < v1.length; i++) {
                result.push(v1[i] - v2[i]);
            }
            return result;
        }

        export function vectordistance(v: number[]): number {
            let sumOfSquares = 0;
            for (let i = 0; i < v.length; i++) {
                sumOfSquares += v[i] ** 2;
            }
            return Math.sqrt(sumOfSquares);
        }

        export function vectornormalize(v: number[]): number[] {
            const result = [];
            const dist = vectordistance(v);
            for (let i = 0; i < v.length; i++) {
                result.push(v[i] / dist);
            }
            return result;
        }

        export function vectordot(v1: number[], v2: number[]): number {
            return v1.reduce((sum, val, index) => sum + val * v2[index], 0);
        }

        export function vectorcross3(v1: number[], v2: number[]): number[] {
            return [
                v1[1] * v2[2] - v1[2] * v2[1],
                v1[2] * v2[0] - v1[0] * v2[2],
                v1[0] * v2[1] - v1[1] * v2[0]
            ];
        }

        // determinant of the upper-left 3x3 (works on your 4x4 row arrays)
        export function det3(m: number[][]): number {
            return m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1])
                - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0])
                + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
        }

        export function matmul(m1: number[][], m2: number[][]): number[][] {
            const result = [];
            // i is the row index for m1
            for (let i = 0; i < m1.length; i++) {
                const resultRow: number[] = [];
                // j is the column index for m2
                for (let j = 0; j < m2[0].length; j++) {
                    // dot together row i of m1 with col j of m2
                    let dot = 0;
                    // k is the column index of m1
                    for (let k = 0; k < m1[0].length; k++) {
                        dot += m1[i][k] * m2[k][j];
                    }
                    resultRow.push(dot);
                }
                result.push(resultRow);
            }
            return result;
        }
    }

    export class Mesh {
        public vertices: number[] = [];
        public triangles: number[] = [];
        // right now materials is just the color, not a general thing
        public materials: number[] = [];

        public constructor() {}
    }

    export class Transform {
        private _scale: number[];
        private _rotation: number[];
        private _translation: number[];

        private _matricesDirty: boolean = true;
        private _matrixM: number[][];

        public constructor() {
            this.scale = [1, 1, 1];
            this.rotation = [0, 0, 0];
            this.translation = [0, 0, 0];
        }

        public get scale(): number[] {
            return this._scale;
        }

        public set scale(s: number[]) {
            this._scale = s;
            this._matricesDirty = true;
        }

        public get rotation(): number[] {
            return this._rotation;
        }
        
        public set rotation(r: number[]) {
            this._rotation = r;
            this._matricesDirty = true;
        }

        public get translation(): number[] {
            return this._translation;
        }

        public set translation(t: number[]) {
            this._translation = t;
            this._matricesDirty = true;
        }

        private _recomputeMatrices() {
            const sx = this.scale[0];
            const sy = this.scale[1];
            const sz = this.scale[2];
            const matrixS = [
                [sx, 0, 0, 0],
                [0, sy, 0, 0],
                [0, 0, sz, 0],
                [0, 0, 0, 1]
            ];

            const rx = this.rotation[0];
            const ry = this.rotation[1];
            const rz = this.rotation[2];
            const sinRz = Math.sin(rz);
            const cosRz = Math.cos(rz);
            const matrixRz = [
                [cosRz, -sinRz, 0, 0],
                [sinRz, cosRz, 0, 0],
                [0, 0, 1, 0],
                [0, 0, 0, 1]
            ];
            const sinRx = Math.sin(rx);
            const cosRx = Math.cos(rx);
            const matrixRx = [
                [1, 0, 0, 0],
                [0, cosRx, -sinRx, 0],
                [0, sinRx, cosRx, 0],
                [0, 0, 0, 1]
            ];
            const sinRy = Math.sin(ry);
            const cosRy = Math.cos(ry);
            const matrixRy = [
                [cosRy, 0, sinRy, 0],
                [0, 1, 0, 0],
                [-sinRy, 0, cosRy, 0],
                [0, 0, 0, 1]
            ];
            const matrixR = LinearAlgebra.matmul(matrixRy, LinearAlgebra.matmul(matrixRx, matrixRz));

            const tx = this.translation[0];
            const ty = this.translation[1];
            const tz = this.translation[2];
            const matrixT = [
                [1, 0, 0, tx],
                [0, 1, 0, ty],
                [0, 0, 1, tz],
                [0, 0, 0, 1]
            ];

            this._matrixM = LinearAlgebra.matmul(matrixT, LinearAlgebra.matmul(matrixR, matrixS));
        }

        public get matrixM(): number[][] {
            if (this._matricesDirty) {
                this._matricesDirty = false;
                this._recomputeMatrices();
            }
            return this._matrixM;
        }
    }

    export class Model {
        public mesh: Mesh;
        public transform: Transform;

        public constructor(mesh: Mesh, transform?: Transform) {
            this.mesh = mesh;
            this.transform = transform ? transform : new Transform();
        }
    }

    export class Camera {
        // for view matrix
        private _eye: number[];
        private _target: number[];

        private _matrixVDirty = true;
        private _matrixV: number[][];
        // for clip space matrix
        private _fovY: number = 70 * Math.PI / 180;
        private _aspect: number;
        private _near: number = 0.1;
        private _far: number = 100;

        private _matrixCDirty = true;
        private _matrixC: number[][];

        public constructor(eye: number[], target: number[], aspectRatio: number) {
            this.eye = eye;
            this.target = target;
            this.aspectRatio = aspectRatio;
        }

        public get eye(): number[] {
            return this._eye;
        }

        public set eye(e: number[]) {
            this._eye = e;
            this._matrixVDirty = true;
        }

        public get target(): number[] {
            return this._target;
        }

        public set target(t: number[]) {
            this._target = t;
            this._matrixVDirty = true;
        }

        private _recomputeVMatrix() {
            let up = [0, 1, 0];
            const zAxis = LinearAlgebra.vectornormalize(LinearAlgebra.vectorsub(this.eye, this.target));
            // if the view direction is (nearly) parallel to `up`, cross(up, zAxis) ~ 0
            // and normalize blows up. Swap to a different reference up for this case.
            if (Math.abs(zAxis[1]) > 0.999) {
                up = [0, 0, 1];
            }
            const xAxis = LinearAlgebra.vectornormalize(LinearAlgebra.vectorcross3(up, zAxis));
            const yAxis = LinearAlgebra.vectorcross3(zAxis, xAxis);
            // matrix for world to camera (view matrix)
            this._matrixV = [
                [xAxis[0], xAxis[1], xAxis[2], -LinearAlgebra.vectordot(xAxis, this.eye)],
                [yAxis[0], yAxis[1], yAxis[2], -LinearAlgebra.vectordot(yAxis, this.eye)],
                [zAxis[0], zAxis[1], zAxis[2], -LinearAlgebra.vectordot(zAxis, this.eye)],
                [0, 0, 0, 1]
            ]
        }

        public get matrixV(): number[][] {
            if (this._matrixVDirty) {
                this._matrixVDirty = false;
                this._recomputeVMatrix();
            }
            return this._matrixV;
        }

        public get fovY(): number {
            return this._fovY;
        }

        public set fovY(fy: number) {
            this._fovY = fy;
            this._matrixCDirty = true;
        }

        // public set fovX(fx: number) {
        //     this._fovY = 2 * Math.atan(Math.tan(fx / 2) / aspect);
        // }

        public get aspectRatio(): number {
            return this._aspect;
        }

        public set aspectRatio(aspect: number) {
            this._aspect = aspect;
            this._matrixCDirty = true;
        }

        public get near(): number {
            return this._near;
        }

        public set near(n: number) {
            this._near = n;
            this._matrixCDirty = true;
        }

        public get far(): number {
            return this._far;
        }

        public set far(f: number) {
            this._far = f;
            this._matrixCDirty = true;
        }

        private _recomputeCMatrix() {
            const f = 1 / Math.tan(this.fovY / 2);
            const A = -(this.far + this.near) / (this.far - this.near);
            const B = -2 * this.far * this.near / (this.far - this.near);
            this._matrixC = [
                [f / this.aspectRatio, 0, 0, 0],
                [0, f, 0, 0],
                [0, 0, A, B],
                [0, 0, -1, 0]
            ];
        }

        public get matrixC(): number[][] {
            if (this._matrixCDirty) {
                this._matrixCDirty = false;
                this._recomputeCMatrix();
            }
            return this._matrixC;
        }
    }

    export class Scene {
        public models: Model[] = [];

        public constructor() {}
    }

    export class Renderer {
        public target: Image;

        private _verticesBuf: number[] = [];
        private _trianglesBuf: number[] = [];
        private _materialsBuf: number[] = [];

        private _verticesBufCount: number = 0;
        private _trianglesBufCount: number = 0;
        private _materialsBufCount: number = 0;

        public constructor(target: Image) {
            this.target = target;
        }

        public render(scene: Scene, camera: Camera) {
            this.target.fill(0);
            const matrixCV = LinearAlgebra.matmul(camera.matrixC, camera.matrixV);
            for (const model of scene.models) {
                this._renderModel(model, matrixCV, camera.near);
            }
        }

        private _renderModel(model: Model, matrixCV: number[][], near: number) {
            //// copy data from model vertices and indicies
            // make every vector 4 long instead of 3 long, have space for w for verticies
            for (let i = 0; i < model.mesh.vertices.length / 3; i++) {
                this._verticesBuf[4 * i] = model.mesh.vertices[3 * i];
                this._verticesBuf[4 * i + 1] = model.mesh.vertices[3 * i + 1];
                this._verticesBuf[4 * i + 2] = model.mesh.vertices[3 * i + 2];
                this._verticesBuf[4 * i + 3] = 1;
            }
            this._verticesBufCount = model.mesh.vertices.length / 3;
            // _trianglesBuf and materialsBuf is handled later in the pipeline

            //// apply MVC to vertices
            const matrixM = model.transform.matrixM;
            const matrixMVC = LinearAlgebra.matmul(matrixCV, matrixM);
            // apply MVC to vertices
            for (let i = 0; i < this._verticesBufCount * 4; i += 4) {
                const vertex = [
                    [this._verticesBuf[i]],
                    [this._verticesBuf[i + 1]],
                    [this._verticesBuf[i + 2]],
                    [this._verticesBuf[i + 3]],
                ];
                const newVertex = LinearAlgebra.matmul(matrixMVC, vertex);
                this._verticesBuf[i] = newVertex[0][0];
                this._verticesBuf[i + 1] = newVertex[1][0];
                this._verticesBuf[i + 2] = newVertex[2][0];
                this._verticesBuf[i + 3] = newVertex[3][0];
            }
            const mirrored = LinearAlgebra.det3(matrixM) < 0;

            //// fills _trianglesBuf from triangles and clips; fills _materialsBuf
            this._trianglesBufCount = 0;
            this._materialsBufCount = 0;
            for (let i = 0; i < model.mesh.triangles.length; i += 3) {
                let a = model.mesh.triangles[i];
                let b = mirrored ? model.mesh.triangles[i + 2] : model.mesh.triangles[i + 1];
                let c = mirrored ? model.mesh.triangles[i + 1] : model.mesh.triangles[i + 2];
                const color = model.mesh.materials[i / 3];

                const inA = this._verticesBuf[4 * a + 3] >= near;
                const inB = this._verticesBuf[4 * b + 3] >= near;
                const inC = this._verticesBuf[4 * c + 3] >= near;
                const inCount = (inA ? 1 : 0) + (inB ? 1 : 0) + (inC ? 1 : 0);

                // handle the four cases of triangles
                // fully behind the near plane, skip
                if (inCount == 0) {
                    continue;
                }
                // fully in the screen, easy
                else if (inCount == 3) {
                    // add the triangle in completely normally
                    this._emitTriangle(a, b, c, color);
                }
                // two points outside, generate a new triangle
                else if (inCount == 1) {
                    // rotate so `a` is the one inside. rotations preserve winding.
                    if (inB) {
                        const oa = a; a = b; b = c; c = oa;          // (a,b,c) -> (b,c,a)
                    } else if (inC) {
                        const oa = a, ob = b; a = c; b = oa; c = ob; // (a,b,c) -> (c,a,b)
                    }
                    this._emitTriangle(
                        a, 
                        this._clipLerpNear(a, b, near),
                        this._clipLerpNear(c, a, near),
                        color
                    );
                }
                // one point outside, generate two triangles
                else /* if (inCount == 2) */ {
                    if (!inA) {
                        const oa = a; a = b; b = c; c = oa;
                    } else if (!inB) {
                        const oa = a, ob = b; a = c; b = oa; c = ob;
                    }
                    const bc = this._clipLerpNear(b, c, near);
                    const ca = this._clipLerpNear(c, a, near);
                    this._emitTriangle(a, b, bc, color);   // quad a, b, bc, ca
                    this._emitTriangle(a, bc, ca, color);  // fanned from a
                }
            }

            //// perspective
            // apply to vertices
            for (let i = 0; i < this._verticesBufCount * 4; i += 4) {
                const vertex = [
                    [this._verticesBuf[i]],
                    [this._verticesBuf[i + 1]],
                    [this._verticesBuf[i + 2]],
                    [this._verticesBuf[i + 3]],
                ];
                const w = vertex[3][0];
                // now in NDC
                this._verticesBuf[i] = vertex[0][0] / w;
                this._verticesBuf[i + 1] = vertex[1][0] / w;
                this._verticesBuf[i + 2] = vertex[2][0] / w;
                // convert X and Y to screen coords, Z still in NDC (-1 near, 1 far plane)
                this._verticesBuf[i] = (this._verticesBuf[i] + 1) * 0.5 * this.target.width - 0.5;
                // flip Y, NDC has +Y up, screen has +Y down
                this._verticesBuf[i + 1] = (1 - this._verticesBuf[i + 1]) * 0.5 * this.target.height - 0.5;
                // console.log(`${verticesTransform[0]}, ${verticesTransform[1]}, ${verticesTransform[2]}`);
            }

            //// backface cull
            let newTrianglesBufCount = 0;
            for (let i = 0; i < this._trianglesBufCount * 3; i += 3) {
                // fetch vertex indices
                const i0 = this._trianglesBuf[i];
                const i1 = this._trianglesBuf[i + 1];
                const i2 = this._trianglesBuf[i + 2];
                // get px coords
                const ax = this._verticesBuf[4 * i0];
                const ay = this._verticesBuf[4 * i0 + 1];
                const bx = this._verticesBuf[4 * i1];
                const by = this._verticesBuf[4 * i1 + 1];
                const cx = this._verticesBuf[4 * i2];
                const cy = this._verticesBuf[4 * i2 + 1];
                // calculate area
                const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
                // area = negative means front facing (keep)
                if (area < 0) {
                    this._trianglesBuf[3 * newTrianglesBufCount] = i0;
                    this._trianglesBuf[3 * newTrianglesBufCount + 1] = i1;
                    this._trianglesBuf[3 * newTrianglesBufCount + 2] = i2;
                    this._materialsBuf[newTrianglesBufCount] = this._materialsBuf[i / 3];
                    newTrianglesBufCount++;
                }
            }
            this._trianglesBufCount = newTrianglesBufCount;
            this._materialsBufCount = newTrianglesBufCount;

            //// triangle drawing
            for (let i = 0; i < this._trianglesBufCount * 3; i += 3) {
                // fetch vertex indices
                const i0 = this._trianglesBuf[i];
                const i1 = this._trianglesBuf[i + 1];
                const i2 = this._trianglesBuf[i + 2];
                // get px coords
                const ax = this._verticesBuf[4 * i0];
                const ay = this._verticesBuf[4 * i0 + 1];
                const bx = this._verticesBuf[4 * i1];
                const by = this._verticesBuf[4 * i1 + 1];
                const cx = this._verticesBuf[4 * i2];
                const cy = this._verticesBuf[4 * i2 + 1];
                // get material (flat color for now)
                const c = this._materialsBuf[i / 3];
                // picture.drawLine(ax, ay, bx, by, c);
                // picture.drawLine(bx, by, cx, cy, c);
                // picture.drawLine(cx, cy, ax, ay, c);
                // fill triangles TODO Z BUFFER
                this.target.fillTriangle(ax, ay, bx, by, cx, cy, c);
            }
        }

        // append a new vertex on the segment ia->ib, exactly on the near plane.
        // both are indices into verticesTransform, in CLIP SPACE (before divide).
        private _clipLerpNear(ia: number, ib: number, near: number): number {
            if (ia > ib) { const t = ia; ia = ib; ib = t; }

            const a = 4 * ia;
            const b = 4 * ib;
            const wa = this._verticesBuf[a + 3];
            const wb = this._verticesBuf[b + 3];
            const t = (wa - near) / (wa - wb);

            const o = 4 * this._verticesBufCount;
            this._verticesBuf[o] = this._verticesBuf[a] + t * (this._verticesBuf[b] - this._verticesBuf[a]);
            this._verticesBuf[o + 1] = this._verticesBuf[a + 1] + t * (this._verticesBuf[b + 1] - this._verticesBuf[a + 1]);
            this._verticesBuf[o + 2] = this._verticesBuf[a + 2] + t * (this._verticesBuf[b + 2] - this._verticesBuf[a + 2]);
            this._verticesBuf[o + 3] = this._verticesBuf[a + 3] + t * (this._verticesBuf[b + 3] - this._verticesBuf[a + 3]);

            return this._verticesBufCount++;
        }

        private _emitTriangle(a: number, b: number, c: number, color: number) {
            const o = 3 * this._trianglesBufCount;
            this._trianglesBuf[o] = a;
            this._trianglesBuf[o + 1] = b;
            this._trianglesBuf[o + 2] = c;
            this._trianglesBufCount++;
            this._materialsBuf[this._materialsBufCount++] = color;
        }
    }
}

// 8 unique corners, 3 numbers each
// index i occupies slots 3i, 3i+1, 3i+2
const VERTICES = [
    -1, -1, -1,   // 0  back  bottom left
    1, -1, -1,   // 1  back  bottom right
    1, 1, -1,   // 2  back  top    right
    -1, 1, -1,   // 3  back  top    left
    -1, -1, 1,   // 4  front bottom left
    1, -1, 1,   // 5  front bottom right
    1, 1, 1,   // 6  front top    right
    -1, 1, 1    // 7  front top    left
];
// 12 triangles, 3 indices each, CCW from outside
const TRIANGLES = [
    // front  (+Z)
    4, 5, 6,
    4, 6, 7,

    // back   (-Z)
    0, 3, 2,
    0, 2, 1,

    // left   (-X)
    0, 4, 7,
    0, 7, 3,

    // right  (+X)
    1, 2, 6,
    1, 6, 5,

    // top    (+Y)
    3, 7, 6,
    3, 6, 2,

    // bottom (-Y)
    0, 1, 5,
    0, 5, 4
];
// for every triangle, what color is it
const MATERIALS = [
    2, 
    2, 
    3, 
    3, 
    4, 
    4, 
    5, 
    5, 
    6, 
    6,
    7,
    7
];

const width = scene.screenWidth();
const height = scene.screenHeight();
const aspect = width / height;
const picture = image.create(width, height);
scene.setBackgroundImage(picture);

const cubeMesh = new Testing3D.Mesh()
cubeMesh.vertices = VERTICES;
cubeMesh.triangles = TRIANGLES;
cubeMesh.materials = MATERIALS;
const cubeModel = new Testing3D.Model(cubeMesh);

const camera = new Testing3D.Camera([0, 0, 10], [0, 0, 0], aspect);
camera.fovY = 70 * Math.PI / 180;
camera.near = 0.1;
camera.far = 100;

const modelScene = new Testing3D.Scene();
modelScene.models.push(cubeModel);

const renderer = new Testing3D.Renderer(picture);

game.onUpdate(() => {
    cubeModel.transform.rotation = [
        game.runtime() / 4000 * Math.PI,
        game.runtime() / 4000 * Math.PI,
        game.runtime() / 4000 * Math.PI
    ];
    renderer.render(modelScene, camera);
});
