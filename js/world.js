//==============================================================================
// Author: Nergal
// Date: 2015-03-11
//==============================================================================
// Block: int32
//  1byte = colorMap to palette
//  2byte = x world position
//  3byte = y world position
//  4byte = z world position
//
// Binary string to decimal conversion
String.prototype.bin = function () {
    return parseInt(this, 2);
};

// Decimal to binary string conversion
Number.prototype.bin = function () {
    var sign = (this < 0 ? "-" : "");
    var result = Math.abs(this).toString(2);
    while(result.length < 32) {
        result = "0" + result;
    }
    return sign + result;
}

function Block(p, c) {
    this.color = c;
    this.pos = p;
}

function World() {
    this.worldSize = 192;
    this.chunkSize = 16;
    this.blockSize = 0.1;
    this.chunks; // Chunks + blocks [chunkId][blocks]
    this.chunksActive; // active blocks
    // Faster to loop through array than using hashmap in JS. And we don't want to allocate 4096*4bytes just to keep chunkid 4096.
    this.chunkIdMap = new Array(); // [incr++] = <chunkId>
    this.meshes = new Array();
    this.data;
    this.map = undefined;


    World.prototype.readWorld = function(filename) {
        var image = new Image();
        image.src = filename;

        var ctx = document.createElement('canvas').getContext('2d');
        var that = this;
        image.onload = function() {
            ctx.canvas.width  = image.width;
            ctx.canvas.height = image.height;
            ctx.drawImage(image, 0, 0);
            that.width = image.width;
            that.height = image.height;
            that.map = new Array();

            var imgData = ctx.getImageData(0, 0, that.width, that.height);

            for(var y = 0; y < that.height; y++) {
                var pos = y * that.width * 4;
                that.map[y] = new Array();
                for(var x = 0; x < that.width; x++) {
                    var r = imgData.data[pos++];
                    var g = imgData.data[pos++];
                    var b = imgData.data[pos++];
                    var a = imgData.data[pos++];
                    that.map[y][x] = {'r': r, 'g': g, 'b': b, 'a': a};
                }
            }
            console.log("Read world complete.");

        }
    };


    World.prototype.PreInit = function(amount) {
        this.readWorld("textures/test4.png");
        this.Init(amount);
    };

    World.prototype.Init = function(amount) {        
        if(this.map == undefined) {
            var that = this;
            setTimeout(function() { that.Init()}, 500);
            console.log("loading texture map...");
            return;
        }
        this.chunksActive = new Array();
        this.chunks = new Array();

        var d = 0;
        noise.seed(Math.random());
        var waterlevel = 0;
        for(var x = 0; x < this.worldSize; x++) {
            for(var z = 0; z < this.worldSize; z++) {
                var height = noise.simplex3(x/100, x/200, z/100)*this.worldSize;
                for(var y = 0; y < height; y++) {
                    if(y >= waterlevel) {
                        var density = noise.simplex3(x/100,  y/100 , z/100);
                        if(density > 0.5) {
                            this.AddBlock(x,y,z);
                        }
                    } 
                }   
            }
        }

        for(var i = 0; i < this.chunkIdMap.length; i++) {
            if(this.chunks[i] != undefined) {
                this.RebuildChunk(i);
            }            
        }
        this.drawPhys = 1;
    };

    World.prototype.getChunk = function(chunkId) {
        for(var i = 0; i < this.chunkIdMap.length; i++) {
            if(this.chunkIdMap[i] == chunkId) {
                return this.chunks[i];
            }
        }
        return null;
    };

    World.prototype.AddBlock = function(x, y, z, color) {
        // byte1 = color, byte2 = z, byte3 = y, byte4 = x
        var block = new Block(((x & 0xFF) << 24 | (y & 0xFF) << 16 | (z & 0xFF) << 8), color & 0xFF);

        var chunkId = this.getChunkId(x, y, z);

        var chunkPos = this.worldToChunkPosition(x, y, z);

        var chunk = this.getChunk(chunkId);
        if(chunk == null) {
            this.chunkIdMap.push(chunkId);
            this.chunks[this.chunkIdMap.length-1] = new Array();
            this.chunks[this.chunkIdMap.length-1].push(block);
        } else {
            for(var i = 0; i < chunk.length; i++) {
                if(chunk[i] == block) {
                    return; // block already exists
                }
            }
            chunk.push(block);
        }

        var cx = chunkPos.x;
        if(this.chunksActive[chunkId] == undefined) {
            this.chunksActive[chunkId] = new Array();
        }
        if(this.chunksActive[chunkId][cx] == undefined) {
            this.chunksActive[chunkId][cx] = new Array();
        }
        this.chunksActive[chunkId][cx][chunkPos.y] = this.chunksActive[chunkId][cx][chunkPos.y] | ( 1 << chunkPos.z); 
    };

    World.prototype.GetBlockPosition = function(block) {
        return new THREE.Vector3(((block >> 24) & 0xFF)*this.blockSize,                                    
                                 ((block >> 16) & 0xFF)*this.blockSize,
                                 ((block >> 8) & 0xFF)*this.blockSize); 
    };

    World.prototype.GetBlockColorRGBA = function(block) {
        // Converts palette hexadecimal color to RGB with alpha always 1
        var c = this.palette[(block & 0xFF)];
        return [parseInt(c.substring(0,2)),
            parseInt(c.substring(2,4)),
            parseInt(c.substring(4,6)),
            255];
    };

    World.prototype.GetBlockColor = function(block) {
        // Converts palette hexadecimal color to RGB with alpha always 1
        return this.palette[(block & 0xFF)];
    };

    World.prototype.worldToChunkPosition = function(x, y ,z) {
        var cx = x-(this.chunkSize*parseInt(x/this.chunkSize));  
        var cy = y-(this.chunkSize*parseInt(y/this.chunkSize));  
        var cz = z-(this.chunkSize*parseInt(z/this.chunkSize));  
        return {x: parseInt(cx), y: parseInt(cy), z: parseInt(cz)};
    };

    World.prototype.getChunkId = function(x, y, z) {
        var offset = this.blockSize*this.chunkSize;
        var cx = parseInt(x/this.chunkSize)*offset;
        var cy = parseInt(y/this.chunkSize)*offset;
        var cz = parseInt(z/this.chunkSize)*offset;
        var str = cx+","+cy+","+cz;
        return btoa(str);
    };

    World.prototype.RebuildChunk = function(vcid) {
        var vertices = [];
        var colors = [];


        // Get chunk 
        var rcid = this.chunkIdMap[vcid];

        // Get chunkPosition
        var res = atob(rcid).split(",");
        var chunkPosX = res[0];
        var chunkPosY = res[1];
        var chunkPosZ = res[2];

        var chunk = this.getChunk(rcid);
        if(chunk == null) {
            return;
        }

        // Get bitlist of active blocks in chunk
        var active = this.chunksActive[rcid];
        var x = 0, y = 0, z = 0, color = 0, lx = 0, sides = 0;
        var front = 0, back = 0, bottom = 0, top = 0, right = 0, left = 0;
        var r = 0, g = 0, b = 0; 

        for(var i = 0; i < this.chunks[vcid].length; i++) {
            x = 0, y = 0, z = 0, c = 0, lx = 0, sides = 0;
            front = 0, back = 0, bottom = 0, top = 0, right = 0, left = 0;
            r = 0; g = 0; b = 0;
            //  console.log(this.chunks[vcid]);
            x = (this.chunks[vcid][i].pos >> 24) & 0xFF; // X
            y = (this.chunks[vcid][i].pos >> 16) & 0xFF; // Y
            z = (this.chunks[vcid][i].pos >> 8) & 0xFF;  // Z
            color = this.chunks[vcid][i].color & 0xFF;   // color

            var pos = this.worldToChunkPosition(x, y, z);
            if(pos.z+1 < 16) {
                front = (active[pos.x][pos.y] >> (pos.z+1) ) & 0x01;
            } 
            // Check2: z-1 is active?
            if(pos.z-1 >= 0) {
                back = (active[pos.x][pos.y] >> (pos.z-1) ) & 0x01;
            }
            // Check3: y-1 is active?
            if(y == 0) {
                bottom = 1;
            } else {
                if(active[pos.x][pos.y-1] != undefined) {
                    bottom = (active[pos.x][pos.y-1] >> (pos.z) ) & 0x01;
                }
            }
            // Check4: y+1 is active?
            if(active[pos.x][pos.y+1] != undefined) {
                top = (active[pos.x][pos.y+1] >> (pos.z) ) & 0x01;
            }

            // Check5: x+1 is active?
            if(active[pos.x+1] != undefined) {
                right = (active[pos.x+1][pos.y] >> pos.z ) & 0x01;
            } 
            // Check6: x-1 is active?
            if(active[pos.x-1] != undefined) {
                left = (active[pos.x-1][pos.y] >> pos.z ) & 0x01;
            }

            if((front & back & bottom & top & right & left) == 1) {
                continue;
            }

            if(!bottom) { //liggande
                vertices.push([pos.x*this.blockSize, pos.y*this.blockSize-this.blockSize, pos.z*this.blockSize]);
                vertices.push([pos.x*this.blockSize-this.blockSize, pos.y*this.blockSize-this.blockSize, pos.z*this.blockSize]);
                vertices.push([pos.x*this.blockSize-this.blockSize, pos.y*this.blockSize-this.blockSize, pos.z*this.blockSize-this.blockSize]);

                vertices.push([pos.x*this.blockSize, pos.y*this.blockSize-this.blockSize, pos.z*this.blockSize]);
                vertices.push([pos.x*this.blockSize-this.blockSize, pos.y*this.blockSize-this.blockSize, pos.z*this.blockSize-this.blockSize]);
                vertices.push([pos.x*this.blockSize, pos.y*this.blockSize-this.blockSize, pos.z*this.blockSize-this.blockSize]);
                if(color == 0) {
                    color = this.map[y][x];
                } else {
                    // Color to hex.
                }
                for(var n = 0; n < 6; n++) {
                    colors.push([color.r, color.g, color.b]);
                }
            }
            if(!top) {
                vertices.push([pos.x*this.blockSize, pos.y*this.blockSize, pos.z*this.blockSize]);
                vertices.push([pos.x*this.blockSize-this.blockSize, pos.y*this.blockSize, pos.z*this.blockSize-this.blockSize]);
                vertices.push([pos.x*this.blockSize-this.blockSize, pos.y*this.blockSize, pos.z*this.blockSize]);

                vertices.push([pos.x*this.blockSize, pos.y*this.blockSize, pos.z*this.blockSize]);
                vertices.push([pos.x*this.blockSize, pos.y*this.blockSize, pos.z*this.blockSize-this.blockSize]);
                vertices.push([pos.x*this.blockSize-this.blockSize, pos.y*this.blockSize, pos.z*this.blockSize-this.blockSize]);
                sides += 6;
                if(color == 0) {
                    color = this.map[y][x];
                } else {
                    // Color to hex.
                }
                for(var n = 0; n < 6; n++) {
                    colors.push([color.r, color.g, color.b]);
                }
            }
            if(!front) { // platta
                vertices.push([pos.x*this.blockSize, pos.y*this.blockSize, pos.z*this.blockSize]);
                vertices.push([pos.x*this.blockSize-this.blockSize, pos.y*this.blockSize, pos.z*this.blockSize]);
                vertices.push([pos.x*this.blockSize, pos.y*this.blockSize-this.blockSize, pos.z*this.blockSize]);

                vertices.push([pos.x*this.blockSize-this.blockSize, pos.y*this.blockSize, pos.z*this.blockSize]);
                vertices.push([pos.x*this.blockSize-this.blockSize, pos.y*this.blockSize-this.blockSize, pos.z*this.blockSize]);
                vertices.push([pos.x*this.blockSize, pos.y*this.blockSize-this.blockSize, pos.z*this.blockSize]);
                sides += 6;
                if(color == 0) {
                    color = this.map[y][x];
                } else {
                    // Color to hex.
                }
                for(var n = 0; n < 6; n++) {
                    colors.push([color.r, color.g, color.b]);
                }
            }
            if(!back) { // platta
                vertices.push([pos.x*this.blockSize, pos.y*this.blockSize, pos.z*this.blockSize-this.blockSize]);
                vertices.push([pos.x*this.blockSize, pos.y*this.blockSize-this.blockSize, pos.z*this.blockSize-this.blockSize]);
                vertices.push([pos.x*this.blockSize-this.blockSize, pos.y*this.blockSize-this.blockSize, pos.z*this.blockSize-this.blockSize]);

                vertices.push([pos.x*this.blockSize, pos.y*this.blockSize, pos.z*this.blockSize-this.blockSize]);
                vertices.push([pos.x*this.blockSize-this.blockSize, pos.y*this.blockSize-this.blockSize, pos.z*this.blockSize-this.blockSize]);
                vertices.push([pos.x*this.blockSize-this.blockSize, pos.y*this.blockSize, pos.z*this.blockSize-this.blockSize]);
                sides += 6;
                if(color == 0) {
                    color = this.map[y][x];
                } else {
                    // Color to hex.
                }
                for(var n = 0; n < 6; n++) {
                    colors.push([color.r, color.g, color.b]);
                }
            }
            if(!left) {
                vertices.push([pos.x*this.blockSize-this.blockSize, pos.y*this.blockSize-this.blockSize, pos.z*this.blockSize-this.blockSize]);
                vertices.push([pos.x*this.blockSize-this.blockSize, pos.y*this.blockSize-this.blockSize, pos.z*this.blockSize]);
                vertices.push([pos.x*this.blockSize-this.blockSize, pos.y*this.blockSize, pos.z*this.blockSize]);

                vertices.push([pos.x*this.blockSize-this.blockSize, pos.y*this.blockSize-this.blockSize, pos.z*this.blockSize-this.blockSize]);
                vertices.push([pos.x*this.blockSize-this.blockSize, pos.y*this.blockSize, pos.z*this.blockSize]);
                vertices.push([pos.x*this.blockSize-this.blockSize, pos.y*this.blockSize, pos.z*this.blockSize-this.blockSize]);
                sides += 6;
                if(color == 0) {
                    color = this.map[y][x];
                } else {
                    // Color to hex.
                }
                for(var n = 0; n < 6; n++) {
                    colors.push([color.r, color.g, color.b]);
                }
            }
            if(!right) {
                vertices.push([pos.x*this.blockSize, pos.y*this.blockSize-this.blockSize, pos.z*this.blockSize-this.blockSize]);
                vertices.push([pos.x*this.blockSize, pos.y*this.blockSize, pos.z*this.blockSize]);
                vertices.push([pos.x*this.blockSize, pos.y*this.blockSize-this.blockSize, pos.z*this.blockSize]);

                vertices.push([pos.x*this.blockSize, pos.y*this.blockSize, pos.z*this.blockSize]);
                vertices.push([pos.x*this.blockSize, pos.y*this.blockSize-this.blockSize, pos.z*this.blockSize-this.blockSize]);
                vertices.push([pos.x*this.blockSize, pos.y*this.blockSize, pos.z*this.blockSize-this.blockSize]);
                sides += 6;
                if(color == 0) {
                    color = this.map[y][x];
                } else {
                    // Color to hex.
                }
                for(var n = 0; n < 6; n++) {
                    colors.push([color.r, color.g, color.b]);
                }
            }

        }

        // Draw chunk
        var geometry = new THREE.BufferGeometry();
        var v = new THREE.BufferAttribute( new Float32Array( vertices.length * 3), 3 );
        for ( var i = 0; i < vertices.length; i++ ) {
            v.setXYZ(i, vertices[i][0], vertices[i][1], vertices[i][2]);
        }
        geometry.addAttribute( 'position', v );

        var c = new THREE.BufferAttribute(new Float32Array( colors.length * 3), 3 );
        for ( var i = 0; i < colors.length; i++ ) {
            c.setXYZW( i, colors[i][0]/255, colors[i][1]/255, colors[i][2]/255, 1);
        }
        geometry.addAttribute( 'color', c );

        geometry.computeVertexNormals();
        geometry.computeFaceNormals();
        var material = new THREE.MeshLambertMaterial({ vertexColors: THREE.VertexColors, wireframe: false});
        var mesh = new THREE.Mesh( geometry, material);

        mesh.position.set(chunkPosX, chunkPosY , chunkPosZ);
        mesh.receiveShadow = true;
        mesh.castShadow = true;

        game.scene.add( mesh );
    };
}



