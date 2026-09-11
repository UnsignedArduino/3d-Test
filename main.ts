game.consoleOverlay.setVisible(true);
game.stats = true;

// 8 unique corners, 3 numbers each
// index i occupies slots 3i, 3i+1, 3i+2
const vertices = [
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
const triangles = [
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
const materials = [
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

// all coordinates assume right handed y up

// scale
let sx = 1;
let sy = 1;
let sz = 1;
// radians rotated around x/y/z axes, z->x->y
let rx = 0;
let ry = 0;
let rz = 0;
// translation
let tx = 0;
let ty = 0;
let tz = 0;
// camera eye pos
let cex = 0;
let cey = 0;
let cez = 5;
// camera target post
let ctx = 0;
let cty = 0;
let ctz = 0;
// camera fov
// either use fov Y directly or derived from fov x
// const cfx = 70 * Math.PI / 180;
// const cfy = 2 * Math.atan(Math.tan(cfx / 2) / aspect)
let cfy = 70 * Math.PI / 180;
// camera near/far
let cn = 0.1
let cf = 100;

function vectorsub(v1: number[], v2: number[]): number[] {
    const result = [];
    for (let i = 0; i < v1.length; i ++) {
        result.push(v1[i] - v2[i]);
    }
    return result;
}

function vectordistance(v: number[]): number {
    let sumOfSquares = 0;
    for (let i = 0; i < v.length; i ++) {
        sumOfSquares += v[i] ** 2;
    }
    return Math.sqrt(sumOfSquares);
}

function vectornormalize(v: number[]): number[] {
    const result = [];
    const dist = vectordistance(v);
    for (let i = 0; i < v.length; i ++) {
        result.push(v[i] / dist);
    }
    return result;
}

function vectordot(v1: number[], v2: number[]): number {
    return v1.reduce((sum, val, index) => sum + val * v2[index], 0);
}

function vectorcross3(v1: number[], v2: number[]): number[] {
    return [
        v1[1] * v2[2] - v1[2] * v2[1],
        v1[2] * v2[0] - v1[0] * v2[2],
        v1[0] * v2[1] - v1[1] * v2[0]
    ];
}

// determinant of the upper-left 3x3 (works on your 4x4 row arrays)
function det3(m: number[][]): number {
    return m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1])
        - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0])
        + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
}

function matmul(m1: number[][], m2: number[][]): number[][] {
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

// init a new vertices array that has fourth element w
const verticesTransform: number[] = [];
const trianglesTransform: number[] = [];
const materialsTransform: number[] = [];

let verticesTransformCount = 0;
let trianglesTransformCount = 0;
let materialsTransformCount = 0;

function render() {
    //// copy data from model vertices and indicies
    // make every vector 4 long instead of 3 long, have space for w for verticies
    for (let i = 0; i < vertices.length / 3; i ++) {
        verticesTransform[4 * i] = vertices[3 * i];
        verticesTransform[4 * i + 1] = vertices[3 * i + 1];
        verticesTransform[4 * i + 2] = vertices[3 * i + 2];
        verticesTransform[4 * i + 3] = 1;
    }
    verticesTransformCount = vertices.length / 3;
    // trianglesTransform and materialsTransform is handled later in the pipeline

    //// model to world coords
    // scale matrix
    const matrixS = [
        [sx, 0, 0, 0],
        [0, sy, 0, 0],
        [0, 0, sz, 0],
        [0, 0, 0, 1]
    ];
    // rotation matrices
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
    // translation matrix
    const matrixT = [
        [1, 0, 0, tx],
        [0, 1, 0, ty],
        [0, 0, 1, tz],
        [0, 0, 0, 1]
    ];
    // world matrix
    // Standard Yaw-Pitch-Roll order: Z -> X -> Y
    const matrixFullR = matmul(matrixRy, matmul(matrixRx, matrixRz));
    // Full Model/World matrix: Scale -> Rotate -> Translate
    const matrixM = matmul(matrixT, matmul(matrixFullR, matrixS));
    //// world to camera coords
    // basis construction
    const eye = [cex, cey, cez];
    const target = [ctx, cty, ctz];
    let up = [0, 1, 0];
    const zAxis = vectornormalize(vectorsub(eye, target));
    // if the view direction is (nearly) parallel to `up`, cross(up, zAxis) ~ 0
    // and normalize blows up. Swap to a different reference up for this case.
    if (Math.abs(zAxis[1]) > 0.999) {
        up = [0, 0, 1];
    }
    const xAxis = vectornormalize(vectorcross3(up, zAxis));
    const yAxis = vectorcross3(zAxis, xAxis);
    // matrix for world to camera (view matrix)
    const matrixV = [
        [xAxis[0], xAxis[1], xAxis[2], -vectordot(xAxis, eye)],
        [yAxis[0], yAxis[1], yAxis[2], -vectordot(yAxis, eye)],
        [zAxis[0], zAxis[1], zAxis[2], -vectordot(zAxis, eye)],
        [0, 0, 0, 1]
    ]
    //// clip space
    // matrix for clip space
    const f = 1 / Math.tan(cfy / 2);
    const A = -(cf + cn) / (cf - cn);
    const B = -2 * cf * cn / (cf - cn);
    const matrixC = [
        [f / aspect, 0, 0, 0],
        [0, f, 0, 0],
        [0, 0, A, B],
        [0, 0, -1, 0]
    ];
    //// combined matrix
    // const matrixMVC = matmul(matrixC, matmul(matrixV, matrixM));
    const matrixMV = matmul(matrixV, matrixM);
    const matrixMVC = matmul(matrixC, matrixMV);
    // determinant of the top left 3x3 of the MV matrix tells if all the scaling done
    // turns it inside out or not, important for backface culling and other stuff idk
    const mirrored = det3(matrixMV) < 0;
    // apply combined matrix to vertices
    for (let i = 0; i < verticesTransformCount * 4; i += 4) {
        const vertex = [
            [verticesTransform[i]],
            [verticesTransform[i + 1]],
            [verticesTransform[i + 2]],
            [verticesTransform[i + 3]],
        ];
        const newVertex = matmul(matrixMVC, vertex);
        verticesTransform[i] = newVertex[0][0];
        verticesTransform[i + 1] = newVertex[1][0];
        verticesTransform[i + 2] = newVertex[2][0];
        verticesTransform[i + 3] = newVertex[3][0];
    }
    //// fills trianglesTransform from triangles and clips
    trianglesTransformCount = 0;
    materialsTransformCount = 0;

    // append a new vertex on the segment ia->ib, exactly on the near plane.
    // both are indices into verticesTransform, in CLIP SPACE (before divide).
    function clipLerpNear(ia: number, ib: number): number {
        if (ia > ib) { const t = ia; ia = ib; ib = t; }

        const a = 4 * ia;
        const b = 4 * ib;
        const wa = verticesTransform[a + 3];
        const wb = verticesTransform[b + 3];
        const t = (wa - cn) / (wa - wb);

        const o = 4 * verticesTransformCount;
        verticesTransform[o] = verticesTransform[a] + t * (verticesTransform[b] - verticesTransform[a]);
        verticesTransform[o + 1] = verticesTransform[a + 1] + t * (verticesTransform[b + 1] - verticesTransform[a + 1]);
        verticesTransform[o + 2] = verticesTransform[a + 2] + t * (verticesTransform[b + 2] - verticesTransform[a + 2]);
        verticesTransform[o + 3] = verticesTransform[a + 3] + t * (verticesTransform[b + 3] - verticesTransform[a + 3]);

        return verticesTransformCount++;
    }

    function emitTriangle(a: number, b: number, c: number, color: number) {
        const o = 3 * trianglesTransformCount;
        trianglesTransform[o] = a;
        trianglesTransform[o + 1] = b;
        trianglesTransform[o + 2] = c;
        trianglesTransformCount++;
        materialsTransform[materialsTransformCount++] = color;
    }

    for (let i = 0; i < triangles.length; i += 3) {
        let a = triangles[i];
        let b = mirrored ? triangles[i + 2] : triangles[i + 1];
        let c = mirrored ? triangles[i + 1] : triangles[i + 2];
        const color = materials[i / 3];

        const inA = verticesTransform[4 * a + 3] >= cn;
        const inB = verticesTransform[4 * b + 3] >= cn;
        const inC = verticesTransform[4 * c + 3] >= cn;
        const inCount = (inA ? 1 : 0) + (inB ? 1 : 0) + (inC ? 1 : 0);

        // handle the four cases of triangles
        // fully behind the near plane, skip
        if (inCount == 0) {
            continue;
        }
        // fully in the screen, easy
        else if (inCount == 3) {
            // add the triangle in completely normally
            emitTriangle(a, b, c, color);
        }
        // two points outside, generate a new triangle
        else if (inCount == 1) {
            // rotate so `a` is the one inside. rotations preserve winding.
            if (inB) {
                const oa = a; a = b; b = c; c = oa;          // (a,b,c) -> (b,c,a)
            } else if (inC) {
                const oa = a, ob = b; a = c; b = oa; c = ob; // (a,b,c) -> (c,a,b)
            }
            emitTriangle(a, clipLerpNear(a, b), clipLerpNear(c, a), color);
        }
        // one point outside, generate two triangles
        else /* if (inCount == 2) */ {
            if (!inA) {
                const oa = a; a = b; b = c; c = oa;
            } else if (!inB) {
                const oa = a, ob = b; a = c; b = oa; c = ob;
            }
            const bc = clipLerpNear(b, c);
            const ca = clipLerpNear(c, a);
            emitTriangle(a, b, bc, color);   // quad a, b, bc, ca
            emitTriangle(a, bc, ca, color);  // fanned from a
        }
    }
    //// perspective
    // apply to vertices
    for (let i = 0; i < verticesTransformCount * 4; i += 4) {
        const vertex = [
            [verticesTransform[i]],
            [verticesTransform[i + 1]],
            [verticesTransform[i + 2]],
            [verticesTransform[i + 3]],
        ];
        const w = vertex[3][0];
        // now in NDC
        verticesTransform[i] = vertex[0][0] / w;
        verticesTransform[i + 1] = vertex[1][0] / w;
        verticesTransform[i + 2] = vertex[2][0] / w;
        // convert X and Y to screen coords, Z still in NDC (-1 near, 1 far plane)
        verticesTransform[i] = (verticesTransform[i] + 1) * 0.5 * width - 0.5;
        // flip Y, NDC has +Y up, screen has +Y down
        verticesTransform[i + 1] = (1 - verticesTransform[i + 1]) * 0.5 * height - 0.5;
        // console.log(`${verticesTransform[0]}, ${verticesTransform[1]}, ${verticesTransform[2]}`);
    }
    //// backface cull
    let newTrianglesTransformCount = 0;
    for (let i = 0; i < trianglesTransformCount * 3; i += 3) {
        // fetch vertex indices
        const i0 = trianglesTransform[i];
        const i1 = trianglesTransform[i + 1];
        const i2 = trianglesTransform[i + 2];
        // get px coords
        const ax = verticesTransform[4 * i0];
        const ay = verticesTransform[4 * i0 + 1];
        const bx = verticesTransform[4 * i1];
        const by = verticesTransform[4 * i1 + 1];
        const cx = verticesTransform[4 * i2];
        const cy = verticesTransform[4 * i2 + 1];
        // calculate area
        const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
        // area = negative means front facing (keep)
        if (area < 0) {
            trianglesTransform[3 * newTrianglesTransformCount] = i0;
            trianglesTransform[3 * newTrianglesTransformCount + 1] = i1;
            trianglesTransform[3 * newTrianglesTransformCount + 2] = i2;
            materialsTransform[newTrianglesTransformCount] = materialsTransform[i / 3];
            newTrianglesTransformCount++;
        }
    }
    trianglesTransformCount = newTrianglesTransformCount;
    materialsTransformCount = newTrianglesTransformCount;
    //// wireframe draw!!!
    // draw triangles out
    for (let i = 0; i < trianglesTransformCount * 3; i += 3) {
        // fetch vertex indices
        const i0 = trianglesTransform[i];
        const i1 = trianglesTransform[i + 1];
        const i2 = trianglesTransform[i + 2];
        // get px coords
        const ax = verticesTransform[4 * i0];
        const ay = verticesTransform[4 * i0 + 1];
        const bx = verticesTransform[4 * i1];
        const by = verticesTransform[4 * i1 + 1];
        const cx = verticesTransform[4 * i2];
        const cy = verticesTransform[4 * i2 + 1];
        // get flat color for now
        const c = materialsTransform[i / 3];
        // draw triangle!
        // picture.drawLine(ax, ay, bx, by, c);
        // picture.drawLine(bx, by, cx, cy, c);
        // picture.drawLine(cx, cy, ax, ay, c);
        picture.fillTriangle(ax, ay, bx, by, cx, cy, c);
    }
}

game.onUpdate(() => {
    rx = game.runtime() / 4000 * Math.PI;
    ry = game.runtime() / 4000 * Math.PI;
    rz = game.runtime() / 4000 * Math.PI;
    
    picture.fill(0);
    render();
});
