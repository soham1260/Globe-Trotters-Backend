require('dotenv').config()
const mongoose = require('mongoose');
mongoose.connect(process.env.DB);
const express = require('express');
const app = express();
var cors = require("cors");
app.use(cors());
app.use(express.json());

const multer  = require('multer');
const upload = multer();

const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.API_KEY,
  api_secret: process.env.API_SECRET
});

app.listen(process.env.PORT,() => {
    console.log("Listening to port "+process.env.PORT);
    console.log("Logging on console "+new Date());
})

const postSchema = new mongoose.Schema({
    date : {type : Date, default : Date.now},
    title : {type : String, required : true},
    content: {type : String, required : true},
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    name: {type: String},
    images: [{
        public_id: { type: String },
        url: { type: String }
    }],
    video: {
        public_id: { type: String },
        url: { type: String }
    }
});
const Post = mongoose.model("Post",postSchema);

const userSchema = new mongoose.Schema({
    name: {type: String,required: true},
    email:{type: String,required: true},
    password : {type : String, required : true},
    posts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Post' }]
});
const User = mongoose.model('User', userSchema);

const JWT_SECRET = process.env.JWT;

app.get('/checkserver',(req,res) => {
    return res.status(200).send("server is running");
})

app.post('/signup', [
            body('name', 'name').isLength({ min: 3 }),
            body('email', 'email').isEmail(),
            body('password', 'password').isLength({ min: 5 }),
        ], (req, res) => {
        
        const errors = validationResult(req);

        if (!errors.isEmpty()) 
        {
            return res.status(400).json({ errors: errors.array() });
        }

        User.findOne({ email: req.body.email })
        .then((user) => {
            if(user) throw new Error("UserExistsError");
        })
        .then(()=>{
            return bcrypt.genSalt();
        })
        .then((salt) => {
            return bcrypt.hash(req.body.password, salt);
        })
        .then((secPass) => {
            return User.create({
                name: req.body.name,
                password: secPass,
                email: req.body.email,
            });
        })
        .then((user) => {
            const data = {
            user:{
                id: user.id
            }
            }
            const authtoken = jwt.sign(data, JWT_SECRET);
            success = true
            console.log(new Date().toLocaleString([], { hour12: false })+" : New user" + user.email + " signed in");
            res.json({success,authtoken})
        })
        .catch ((error) => {
        console.error(error.message);
        if (error.message === "UserExistsError") {
            res.status(400).json({success : false, errors: [{msg : "exist"}] });
        } else {
            console.log(new Date().toLocaleString([], { hour12: false })+" : " +error.message);
            res.status(500).send("Internal Server Error");
        }
        })
})

app.post('/login', [ 
            body('email', 'Enter a valid email').isEmail(), 
            body('password', 'Password cannot be blank').exists(), 
        ], (req, res) => {
    
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
        }
    
        const {email, password} = req.body;
        User.findOne({email})
        .then((user) => { 
            if(!user){
                throw new Error("Invalid email or password");
            }
            return Promise.all([user.id, bcrypt.compare(password, user.password)]);
        })
        .then(([x,passwordCompare]) => {
            if(!passwordCompare){
                throw new Error("Invalid email or password"); 
            }
            const data = {
            user:{
                id: x
            }
            }
            const authtoken = jwt.sign(data, JWT_SECRET);
            console.log(new Date().toLocaleString([], { hour12: false })+" : " + email + " logged in");
            res.json({success : true, authtoken});
        })
        .catch((error) => {
            if(error.message === "Invalid email or password") 
            {
                console.log(new Date().toLocaleString([], { hour12: false })+" : " +error.message+" "+email);
                res.status(400).json({success : false, error: "Please try to login with correct credentials"});
            }
            else
            {
                console.log(new Date().toLocaleString([], { hour12: false })+" : " +error.message);
                res.status(500).send("Internal Server Error");
            }
        })
  })

const fetchuser = (req,res,next ) => {
    const token = req.header('auth-token');
    if(!token){
        res.status(401).send({error : "Invalid token"});
    }

    try {
        const data = jwt.verify(token,JWT_SECRET);
        req.user = data.user;
        console.log(new Date().toLocaleString([], { hour12: false })+" : JWT verified user " + req.user.id);
        next();
    } catch (error) {
        console.log(new Date().toLocaleString([], { hour12: false })+" : JWT verification failed");
        res.status(401).send({error : "Invalid token"});
    }
}

// app.post('/compose', upload.array('file'), fetchuser, [
//     body('title', 'Enter a valid title').exists(),
//     body('content', 'Content must be atleast 5 characters').exists(),
// ], async (req,res) => {
//     try
//     {    
//         const {title,content} = req.body;
//         const files = req.files;
//         console.log(title);
//         const errors = validationResult(req);
//         if (!errors.isEmpty()) {
//             return res.status(400).json({ errors: errors.array() });
//         }
//         const upload = process.env.CLOUDINARY;
        
//         let responseDataArray = []; // Declare responseDataArray outside the if block

//         if (files) {
//             // Map each file to a fetch request and collect the promises
//             const uploadPromises = files.map(async (file) => {
//                 const formData = new FormData();
//                 const blob = new Blob([file.buffer], { type: file.mimetype });
//                 formData.append('file', blob, file.originalname);
//                 formData.append('upload_preset', 'postimages');

//                 try {
//                     const response = await fetch(upload, {
//                         method: 'POST',
//                         body: formData
//                     });
//                     return await response.json(); // Return the response data
//                 } catch (error) {
//                     console.error('Error uploading file:', error);
//                     return { error: error.message }; // Return an error object
//                 }
//             });

//             // Wait for all fetch requests to complete and assign the result to responseDataArray
//             responseDataArray = await Promise.all(uploadPromises);
//         }

//         const secureUrls = responseDataArray.map(responseData => ({
//             public_id: responseData.public_id,
//             url: responseData.secure_url
//         }));
//         console.log(secureUrls);


//         const user = await User.findById(req.user.id);
//         const post = new Post ({
//             title,content,user:req.user.id,name:user.name,images:secureUrls
//         })
//         const savedpost = await post.save();
//         user.posts.push(savedpost.id);
//         await user.save();

//         res.json(savedpost);
//     }
//     catch(error)
//     {
//         console.log(new Date().toLocaleString([], { hour12: false })+" : " +error.message);
//         res.status(500).send("Internal Server Error");
//     }
// })

app.post('/compose',upload.fields([{ name: 'file' }, { name: 'video' }]), fetchuser, [
    body('title', 'Enter a valid title').exists(),
    body('content', 'Content must be atleast 5 characters').exists(),
], async (req, res) => {
    try {
        const { title, content , videourl} = req.body;
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        const files = req.files;
        const secureUrls = [];
        let cloudvideo;

        // Iterate over each file and upload to Cloudinary
        if (files['file'])
        {
            for (const file of files['file']) {
                const base64Data = file.buffer.toString('base64');
                const result = await cloudinary.uploader.upload('data:image/png;base64,' + base64Data, {
                    upload_preset: 'postimages'
                });

                secureUrls.push({
                    public_id: result.public_id,
                    url: result.secure_url
                });
            }
        }
        
        if (files['video'] && files['video'][0]) {
            const videoFile = files['video'][0];
            const base64Data = videoFile.buffer.toString('base64');
            const result = await cloudinary.uploader.upload('data:video/mp4;base64,' + base64Data, {
                resource_type: 'video',
                upload_preset: 'postvideos'
            });

            cloudvideo = {
                public_id: result.public_id,
                url: result.secure_url
            };
        }
        else {
            cloudvideo={
                public_id: "",
                url: videourl
            };
        }

        const user = await User.findById(req.user.id);
        const post = new Post({
            title,
            content,
            user: req.user.id,
            name: user.name,
            images: secureUrls,
            video: cloudvideo
        });

        const savedPost = await post.save();
        user.posts.push(savedPost.id);
        await user.save();

        res.json(savedPost);
    } catch (error) {
        console.error('Error composing post:', error);
        res.status(500).send('Internal Server Error');
    }
});

app.put('/updatepost/:id' ,upload.fields([{ name: 'file' }, { name: 'video' }]),fetchuser , async (req,res) =>{
    let {title,content,removeFiles,videourl,videochange} = req.body;
    const files = req.files;
    removeFiles = JSON.parse(removeFiles);
    try {
        let post = await Post.findById(req.params.id);
        if(!post) {return res.status(404).send("Not found")};
        if(post.user.toString() !== req.user.id) {return res.status(401).send("Unauthorized")};
        const newpost = {};

        if(title){newpost.title = title};
        if(content){newpost.content = content};
        if(removeFiles) {
            for(const file of removeFiles)
            {
                cloudinary.uploader
                .destroy(file.public_id)
                .then(result => console.log(result));
            }
        }
        let images = post.images;
        images = images.filter(image => {
            if (Array.isArray(removeFiles) && removeFiles.length > 0) {
                return !removeFiles.some(file => file.public_id === image.public_id);
            } else {
                return true;
            }
        })
        const secureUrls = [];
        if (files['file'])
        {    
            for (const file of files['file']) {
                const base64Data = file.buffer.toString('base64');
                const result = await cloudinary.uploader.upload('data:image/png;base64,' + base64Data, {
                    upload_preset: 'postimages'
                });

                secureUrls.push({
                    public_id: result.public_id,
                    url: result.secure_url
                });
            }
        }
        secureUrls.forEach(url => images.push(url));
        newpost.images=images;
        
        if(videourl.length !== 0){
            if(post.video.public_id.length !== 0){
                cloudinary.uploader
                .destroy(post.video.public_id, { resource_type: "video" })
                .then(result => console.log(result));
            }
            newpost.video = {
                public_id: "",
                url: videourl
            }
        }
        else if(files['video'] && files['video'][0]) {
            if(post.video.public_id.length !== 0){
                cloudinary.uploader
                .destroy(post.video.public_id, { resource_type: "video" })
                .then(result => console.log(result));
            }

            const videoFile = files['video'][0];
            const base64Data = videoFile.buffer.toString('base64');
            const result = await cloudinary.uploader.upload('data:video/mp4;base64,' + base64Data, {
                resource_type: 'video',
                upload_preset: 'postvideos'
            });

            newpost.video = {
                public_id: result.public_id,
                url: result.secure_url
            };
        }
        else if(videochange){
            console.log(post.video.public_id);
            if(post.video.public_id.length !== 0){
                cloudinary.uploader
                .destroy(post.video.public_id, { resource_type: "video" })
                .then(result => console.log(result));
            }
            newpost.video = {
                public_id: "",
                url: ""
            };
        }

        post = await Post.findByIdAndUpdate(req.params.id , {$set : newpost}, {new : true});
        res.json(post);
    } catch (error) {
        console.log(new Date().toLocaleString([], { hour12: false })+" : " +error.message);
    }
})

app.delete('/deletepost/:id' ,fetchuser , async (req,res) =>{
    try {
        let post = await Post.findById(req.params.id);
        if(!post) {return res.status(404).send("Not found")};

        if(post.user.toString() !== req.user.id) {return res.status(401).send("Unauthorized")};

        const removeFiles = post.images; 
        for(const file of removeFiles)
        {
            cloudinary.uploader
            .destroy(file.public_id)
            .then(result => console.log(result));
        }
        if(post.video.public_id.length !== 0){
            cloudinary.uploader
            .destroy(post.video.public_id, { resource_type: "video" })
            .then(result => console.log(result));
        }
        await Post.findByIdAndDelete(req.params.id);
        let user= await User.findById(req.user.id);
        user.posts.remove(req.params.id);
        await user.save();
        res.send(true);
    } catch (error) {
        console.log(new Date().toLocaleString([], { hour12: false })+" : " +error.message);
        res.status(500).send("Internal Server Error");
    }
})

app.get('/fetchposts' ,fetchuser, async (req,res) => {
    try {
        const posts = await Post.find({user : req.user.id})
        res.json(posts);
    } 
    catch (error) {
        console.log(new Date().toLocaleString([], { hour12: false })+" : " +error.message);
        res.status(500).send("Internal Server Error");
    }
})

app.get('/fetchallposts', async (req,res) => {
    try {
        const posts = await Post.find()
        res.json(posts);
    } 
    catch (error) {
        console.log(new Date().toLocaleString([], { hour12: false })+" : " +error.message);
        res.status(500).send("Internal Server Error");
    }
})

app.get('/search/:query' , async (req,res) => {
    try {
        const query = req.params.query;
        const posts = await Post.find({ $text: { $search: query } });
        res.json(posts);
    }
    catch (error) {
        console.log(new Date().toLocaleString([], { hour12: false })+" : " +error.message);
        res.status(500).send("Internal Server Error");
    }
})

app.get('/post/:id' , async (req,res) => {
    try {
        const id = req.params.id;
        const post = await Post.find({ _id:id });
        res.json(post);
    }
    catch (error) {
        console.log(new Date().toLocaleString([], { hour12: false })+" : " +error.message);
        res.status(500).send("Internal Server Error");
    }
})

app.get('/isloggedin' , async (req,res) => {
    const token = req.header('auth-token');
    if(!token){
        res.status(401).send({error : "Invalid token"});
    }

    try {
        const data = jwt.verify(token,JWT_SECRET);
        res.status(200).send({message : "Valid user"})
    } catch (error) {
        console.log(new Date().toLocaleString([], { hour12: false })+" : JWT verification failed");
        res.status(401).send({error : "Invalid token"});
    }
})