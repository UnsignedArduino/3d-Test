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
let cez = 1.5;
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

let verticesTransformCount = 0;
let trianglesTransformCount = 0;

function render() {
    // copy from model vertices and indicies

    // make every vector 4 long instead of 3 long, have space for w for verticies
    for (let i = 0; i < vertices.length / 3; i ++) {
        verticesTransform[4 * i] = vertices[3 * i];
        verticesTransform[4 * i + 1] = vertices[3 * i + 1];
        verticesTransform[4 * i + 2] = vertices[3 * i + 2];
        verticesTransform[4 * i + 3] = 1;
    }
    verticesTransformCount = vertices.length / 3;
    for (let i = 0; i < triangles.length; i ++) {
        trianglesTransform[i] = triangles[i];
    }
    trianglesTransformCount = triangles.length / 3;

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
    const up = [0, 1, 0];
    const zAxis = vectornormalize(vectorsub(eye, target));
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
    const matrixMVC = matmul(matrixC, matmul(matrixV, matrixM));
    // apply combined matrix to vertices
    for (let i = 0; i < verticesTransform.length; i += 4) {
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
    //// perspective/actual clipping
    // apply to vertices
    for (let i = 0; i < verticesTransform.length; i += 4) {
        const vertex = [
            [verticesTransform[i]],
            [verticesTransform[i + 1]],
            [verticesTransform[i + 2]],
            [verticesTransform[i + 3]],
        ];
        const w = vertex[3][0];
        if (w >= cn) {
            // now in NDC
            verticesTransform[i] = vertex[0][0] / w;
            verticesTransform[i + 1] = vertex[1][0] / w;
            verticesTransform[i + 2] = vertex[2][0] / w;
            // convert X and Y to screen coords, Z still in NDC (-1 near, 1 far plane)
            verticesTransform[i] = (verticesTransform[i] + 1) * 0.5 * width;
            verticesTransform[i + 1] = (1 - verticesTransform[i + 1]) * 0.5 * height;  // flip Y, NDC has +Y up, screen has +Y down
        } else {
            // at or behind the eye, reject
            // todo must handle clipping properly, if any point outside of camera screen gets cooked
            verticesTransform[i] = NaN;
            verticesTransform[i + 1] = NaN;
            verticesTransform[i + 2] = NaN;
        }
        // console.log(`${verticesTransform[0]}, ${verticesTransform[1]}, ${verticesTransform[2]}`);
    }
    //// wireframe draw!!!
    // draw triangles out
    for (let i = 0; i < trianglesTransform.length; i += 3) {
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
        // for now skip if any NaN
        if (ax !== ax || ay !== ay || bx !== bx || by !== by || cx !== cx || cy !== cy) {
            continue;
        }
        // draw triangle!
        picture.drawLine(ax, ay, bx, by, 1);
        picture.drawLine(bx, by, cx, cy, 1);
        picture.drawLine(cx, cy, ax, ay, 1);
    }
}

game.onUpdate(() => {
    // rx = game.runtime() / 4000 * Math.PI;
    ry = game.runtime() / 4000 * Math.PI;
    // rz = game.runtime() / 4000 * Math.PI;

    picture.fill(0);
    render();
});
