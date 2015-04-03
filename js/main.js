//==============================================================================
// Author: Nergal
// Date: 2014-11-17
//==============================================================================
"use strict";

function Game() {
    this.container;
    this.scene;
    this.camera;
    this.renderer;
    this.stats;
    this.clock;
    this.controls;

    // Scene settings
    this.screenWidth = window.innerWidth;
    this.screenHeight = window.innerHeight;
    this.viewAngle = 40;
    this.aspect = this.screenWidth/this.screenHeight;
    this.near = 0.1;
    this.far = 200;
    this.invMaxFps = 1/60;
    this.frameDelta = 0;

    // Object arrays
    this.objects = [];
    this.world = undefined;
    this.phys = undefined;
    this.physMeshes = [];
    this.physBodies = [];

    //==========================================================
    // InitScene
    //==========================================================
    Game.prototype.initScene = function() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(this.viewAngle, this.aspect, this.near, this.far);
        this.camera.position.set(32,25,35);
        this.camera.rotation.set(-2.5, -0.03, -3);
        this.scene.add(this.camera);
    };

    //==========================================================
    // Init other stuff
    //==========================================================
    Game.prototype.Init = function(mapId) {
        this.clock = new THREE.Clock();
        this.stats = new Stats();
        //$('#stats').append(this.stats.domElement);
        this.stats = new Stats();
        this.stats.domElement.style.position = 'absolute';
        this.stats.domElement.style.bottom = '0px';
        this.stats.domElement.style.zIndex = 100;
        $('#container').append( this.stats.domElement );

        this.initScene();

        this.renderer = new THREE.WebGLRenderer( {antialias: false} );
        this.renderer.setSize(this.screenWidth, this.screenHeight);
        this.renderer.shadowMapEnabled = true;
        this.renderer.shadowMapType = THREE.PCFSoftShadowMap;
        this.keyboard = new THREEx.KeyboardState();
        this.container = document.getElementById('container');
        this.container.appendChild(this.renderer.domElement);

        this.scene.fog = new THREE.Fog( 0x333333, 40, 60 );
        this.renderer.setClearColor(0x333333, 1);
        this.controls = new THREE.OrbitControls( this.camera, this.renderer.domElement );

        THREEx.WindowResize(this.renderer, this.camera);
        
        var ambientLight = new THREE.AmbientLight( 0x330000 );
        this.scene.add( ambientLight );

        var hemiLight = new THREE.HemisphereLight( 0xffffff, 0xffffff, 0.9 );
        hemiLight.color.setHSL( 0.6, 1, 0.6 );
        hemiLight.groundColor.setHSL( 0.095, 1, 0.75 );
        hemiLight.position.set( 0, 500, 0 );
        this.scene.add( hemiLight );

        var dirLight = new THREE.DirectionalLight( 0xffffff, 1 );
        dirLight.color.setHSL( 0.1, 1, 0.95 );
        dirLight.position.set( 10, 100.75, 10 );
        dirLight.position.multiplyScalar( 10 );
        this.scene.add( dirLight );

        dirLight.castShadow = true;

        dirLight.shadowMapWidth = 2048;
        dirLight.shadowMapHeight = 2048;

        var d = 150;

        dirLight.shadowCameraLeft = -d;
        dirLight.shadowCameraRight = d;
        dirLight.shadowCameraTop = d;
        dirLight.shadowCameraBottom = -d;

        dirLight.shadowCameraFar = 3500;
        dirLight.shadowBias = -0.0001;
        dirLight.shadowDarkness = 0.45;

        this.world = new World();
        this.world.PreInit(10000); 


        var planeSize = this.world.worldSize*(this.world.blockSize);
        var geo = new THREE.PlaneBufferGeometry(planeSize, planeSize, 1, 1);
        var mat = new THREE.MeshLambertMaterial({color: 0xEED6AF});
        var mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(planeSize/2, 0, planeSize/2);
        mesh.rotation.x = -Math.PI/2;
        this.scene.add(mesh);
        this.CreateWater();

        this.animate();
    };
    
    Game.prototype.CreateWater = function(scene) {
        var planeSize = this.world.worldSize*(this.world.blockSize);
        var geometry = new THREE.PlaneGeometry( planeSize, planeSize, 16 - 1, 16 - 1 );
        geometry.applyMatrix( new THREE.Matrix4().makeRotationX( - Math.PI / 2 ) );
        geometry.dynamic = true;

        var i, j, il, jl;
        for ( i = 0, il = geometry.vertices.length; i < il; i ++ ) {
            geometry.vertices[ i ].y = 0.4 * Math.sin( i/2 );
        }

        geometry.computeFaceNormals();
        geometry.computeVertexNormals();

        var texture = THREE.ImageUtils.loadTexture( "textures/water2.png" );
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set( 10, 10 );

        var material = new THREE.MeshPhongMaterial( { color: 0x00CCFF, map: texture, transparent: true, opacity: 0.5} );

        var mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(planeSize/2, 0.5, planeSize/2);
        mesh.receiveShadow = true;
        this.mesh = mesh;
        this.scene.add(this.mesh);
    };

    Game.prototype.DrawWater= function(time, delta) {
        for ( var i = 0, l = this.mesh.geometry.vertices.length; i < l; i ++ ) {
            this.mesh.geometry.vertices[ i ].y = 0.2 * Math.sin( i / 5 + ( time + i ) / 4 );
        }
        this.mesh.geometry.verticesNeedUpdate = true;
    };

    Game.prototype.onWindowResize = function() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize( window.innerWidth, window.innerHeight );
    };

    Game.prototype.getDistance = function(v1, v2) {
        var dx = v1.x - v2.x;
        var dy = v1.y - v2.y;
        var dz = v1.z - v2.z;
        return Math.sqrt(dx*dx+dy*dy+dz*dz);
    };

    //==========================================================
    // Render
    //==========================================================
    Game.prototype.render = function() {
        this.renderer.render(this.scene, this.camera);
    };

    //==========================================================
    // Animate
    //==========================================================
    Game.prototype.animate = function() {
        this.animId = requestAnimationFrame(this.animate.bind(this));
        this.render();
        this.update();
    };

    //==========================================================
    // Update
    //==========================================================
    Game.prototype.update = function() {
        var delta = this.clock.getDelta(),
        time = this.clock.getElapsedTime() * 10;

        this.frameDelta += delta;

        while(this.frameDelta >= this.invMaxFps) {
            THREE.AnimationHandler.update(this.invMaxFps);
            for(var i = 0; i < this.objects.length; i++) {
                if(this.objects[i] != undefined) {
                    if(this.objects[i].remove == 1) { 
                        this.objects.splice(i, 1);
                    } else {
                        this.objects[i].Draw(time, this.invMaxFps, i);
                    }
                }
            }
            this.frameDelta -= this.invMaxFps;
            this.DrawWater(time, this.invMaxFps);
        }	
        this.stats.update();
        this.controls.update();
    };

    Game.prototype.rand = function(min, max, n) {
        var r, n = n||0;
        if (min < 0) r = min + Math.random() * (Math.abs(min)+max);
        else r = min + Math.random() * max;
        return r.toFixed(n)*1;
    };
}
