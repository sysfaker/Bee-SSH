const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const randomstring = require("randomstring");
const mfa = require('../config/totpAuth');

// Databases
const User = require('../models/User');
const sshdb = require('../models/SSHSessions');
const AuthCookie = require('../models/AuthCookie');


// API
// Get App Version
router.get("/client_version", (req, res) =>{
    res.json({
        version: process.env.CLIENTVERSION
    }).status(200);
});


// REST Login
router.post("/client_login", (req, res) => {
    const {tool, email, password, otp } = req.body;

    // Errors
    let errors = [];

    // Start check
    if(tool != process.env.CLIENTPASSWORD) {
        errors.push("Error");
    }
    if(!email) {
        errors.push("No Username");
    }
    if(!password) {
        errors.push("no password")
    }
    if(errors){
        return res.json({Info: "Some Errors"}).status(400);
    }

    User.findOne({email}).then(user => {
       if(!user)
           return res.json({Info: "Some Errors"}).status(400);

        bcrypt.compare(password + process.env.PASSPEPPER, user.password, (err, isMatch) => {
            if (err) throw err;
            if (isMatch) {
                if(user.mfa) {
                    if(mfa(user.secret, otp)) {
                        sshdb.find({UID: user.UID}).then(sshdata => {
                            const authcookie = randomstring.generate(55);
                            const new_authcookie = new AuthCookie({
                                UID: user.UID,
                                AuthCookie: authcookie
                            });
                            new_authcookie.save();
                            const pack_data = JSON.stringify(sshdata);
                            return res.json({
                                AuthKey: authcookie,
                                data: pack_data
                            }).status(200);
                        })
                    } else {
                        return res.json({Info: "2FA Error"}).status(201);
                    }
                } else {
                    // if there no 2FA
                    sshdb.find({UID: user.UID}).then(sshdata => {
                        const authcookie = randomstring.generate(55);
                        const new_authcookie = new AuthCookie({
                            UID: user.UID,
                            AuthCookie: authcookie
                        });
                        new_authcookie.save();
                        const pack_data = JSON.stringify(sshdata);
                        return res.json({
                            AuthKey: authcookie,
                            data: pack_data
                        }).status(200);
                    })
                }
            } else {
                return res.json({Info: "Some Errors"}).status(400);
            }
        });
    });
});


router.post("/client_new", (req, res) => {
   const { authkey, tool } = req.body;
   const {servername, port, isKEY, ipadress, PsswordorKey} = req.body;

    if(!authkey) {
       return res.status(404);
    }
    if(!tool) {
        return res.status(404);
    }

    if(tool != process.env.CLIENTPASSWORD) {
        return res.status(404);
    }
    AuthCookie.findOne({AuthCookie: authkey}).then(_uid => {
        if(!_uid)
            return res.status(201);

        const newServer = new sshdb({
            name: servername,
            crpyt_ip: ipadress,
            crpyt_password: PsswordorKey,
            crpyt_port: port,
            isKEY: isKEY,
            UID: _uid.UID
        });
        newServer.save();

        return res.status(200);
    })
});

module.exports = router;