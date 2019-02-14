// requiring everything we need
let express = require('express');
let fs = require('fs');
let app = express();
const exec = require('await-exec');



// checking if the variables were set, if they weren't, we serve a page saying they weren't.. DUH
if (!process.env.CLIENT_ID || !process.env.CLIENT_SECRET ||
  process.env.CLIENT_ID=="<YOUR CLIENT ID>" || process.env.CLIENT_SECRET=="<YOUR CLIENT SECRET>"){
	console.log("Environnement variables CLIENT_ID and CLIENT_SECRET weren't set. Unable to contact Blizzard API.\nThe procedure to obtain them is described on the following page: https://github.com/devolution2409/simcraft/README.md");

	app.use('*', function(req,res){
	res.send("Environnement variables CLIENT_ID and CLIENT_SECRET weren't set. Unable to contact Blizzard API.\nThe procedure to obtain them is described on the following page: https://github.com/devolution2409/simcraft/README.md");

	});

}else{



// setting default render engine to htlm (need ejs)
app.set('view engine', 'html');
app.engine('html', require('ejs').renderFile);

// setting the app middleware to account for ./REGION/REALM/CHAR

// TODO: tweak this so that it's only available to answe reply ajax calls
/*app.use('*',function(req,res,next){
        console.log("Is this ajax: " +req.xhr);
	// if ajax => next
	// if not, redirect to /
        next();
});
*/

// ACTUAL TODO: add a check for req.xhr in get, so that it's only available from ajax, and redirects to the
// main page if not ajax.
// Also, try to setup the output format as json and serve a very nice page with chart.js and shit
// basically: if (ajax) 
//               if (charExist) (check via smol api call)
//                  simulate()
//                  serveResult()
//               else
//                  reply = char doesn't exist, so we can update page accordingly
//             else
//               redirect to /
app.get("/eu/medivh/nevess",function(req,res,next){
	res.send("<3");

});

app.get(/\/(EU|NA|KR|TW)\/\w+\/\w+/i,function(req,res,next){
	//res.send("Pog");
	let path = req.originalUrl;
	// path = /eu/suramar/devolution (with or without trailing /)
	path = path.substring(1);
	let infos = path.split('/');
	// info is either ['eu','suramar','devolution'] or ['eu','suramar','devolution','']
	console.log("Received request for:" + infos);

// generating random name for the file
let uuid = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
let file = uuid + '.html';

// variable function here because we need async to be able to await the response before sending it
var lul = async function(){
	await exec( "../engine/simc " + "calculate_scale_factors=1 armory=" + infos[0] + "," + infos[1] + "," + infos [2] + " html=" + file)
	// search how to output stout again forsenE (even tho await-exec might fuck it up)
	.then( (data) => {
	console.log("Generated: " + file );

	// move the file to the right folder because renderer will search in /views/
	fs.renameSync('/simc/web/' + file,'/simc/web/views/' + file, (err) => {
		if (err) throw err;
		else console.log('Moved file to /views/');
	});
	// send .html to client
	console.log("Serving report to client..");
	res.render(file);
	// remove the file 
	fs.unlink('/simc/web/views/' + uuid + '.html', (err) => { 
			if (err) throw err;
			else console.log('File removed from /views/');
			});
	console.log("Simulation request successfully processed!");
		// if exception comes from the command, it will have stderr
		// if stderr contains Char not found, we redirect it to the main page forsenE
		//TODO: api call myself with ajax to see if char exist :)
	})
	.catch( (err) => {
		if(err.hasOwnProperty('stderr'))		
			if (err.stderr.includes("Realm not found")){
				console.log(`Realm: ${infos[1]} not found !`);
				res.send("Realm not found!");
			}else if (err.stderr.includes("Character not found")){
				res.send("Character not found!");
				console.log(`Realm: ${infos[2]} not found !`);

			}

	});


};
	lul();
});

// set GET (and not middleware) to capture every route that's not a character route
// OMEGA redundant with ajax. BUT it's also useful is some 140iq man uses ajax to acces a retarded route
app.get('*',function(req,res,next){
	res.send('TriSad');
});


}// end if variables were set :)


// registering SIGINT so we can ctrl+C when not in detached mode
process.on('SIGINT', function(){
	console.log('\nStopping gracefully..');
	process.exit(0);
});


// Listening to port 80
app.listen(80);


// curl http://ifconfig.me/ip
fs.access('/.dockerenv', fs.F_OK, (err) => {
		if (!err){
			let host = '';
			let getIp = async () => {
			exec("curl http://ifconfig.me/ip").then( (data) =>{
				host = data.stdout;
				console.log("It appears you are running this node application through docker. The application will be available at "+ host + ":externalport");

				});
			};
			getIp();
		}else{
			console.log("Application ready to listen on port 80");
		}
	});
