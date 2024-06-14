const passport = require('passport'); 
const GoogleStrategy = require('passport-google-oauth2').Strategy; 
const User = require('./models/userModel')



passport.use(new GoogleStrategy({ 
	clientID:"755677540600-i09tcee8bdig2d34a4pqp3csokbf56i6.apps.googleusercontent.com", // Your Credentials here. 
	clientSecret:process.env.CLIENT_SECRET, // Your Credentials here. 
	callbackURL:"http://localhost:3000/auth/google/callback", 
	passReqToCallback:true
}, 
function(request, accessToken, refreshToken, profile, done) { 
	console.log(profile.email)
	return done(null, profile); 
} 
));

passport.serializeUser((user , done) => { 
	console.log(user);
	done(null , user); 
}) 
passport.deserializeUser(function(user, done) { 
	done(null, user); 
}); 
