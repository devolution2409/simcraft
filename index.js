// requiring everything we need
let express = require('express');
let fs = require('fs');
let app = express();
//const exec = require('await-exec');
const { spawn } = require('child_process');


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
	//needed to register this as SSE
	res.status(200).set({
		"connection": "keep-alive",
		"cache-control": "no-cache",
		"content-Type": "text/event-stream"
	});
	let path = req.originalUrl;
	// path = /eu/suramar/devolution (with or without trailing /)
	path = path.substring(1);
	let infos = path.split('/');
	// info is either ['eu','suramar','devolution'] or ['eu','suramar','devolution','']
	console.log("Received request for:" + infos);

// generating random name for the file
let uuid = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
let file = uuid + '.html';
let json = uuid + '.json';
// variable function here because we need async to be able to await the response before sending it
var lul = async function(){
	// calculate_scale_factors=1 requires at least >10000 iterations
	let armoryString =  "armory=" + infos[0] + "," + infos[1] + "," + infos[2]
	const child = spawn ( "../engine/simc", [armoryString,"target_error=0.05","html=" + file,"json=" + json,"calculate_scale_factors=1","iterations=10000","fight_style=patchwerk"]);
	//fetching stdout
	let currentStep = 0;
	let stderr = [];
	for await (const err of child.stderr){
		stderr.push(`${err}`);
	}


	for await (const data of child.stdout) {
		if (data.includes("Simulating...")){
			console.log(`${data}`);
		}
  	//	console.log(`stdout from the child: ${data}`);
	// need to apply regexp to stdout to find out which step we at
		let regexp = RegExp(/(Generating \w+): (\d+)\/(\d+) \W+ \d+\/\d+ \w+=\d+ \w+=\d+(\.)?\d+% (\d+min)? ?(\d+sec)?/gm);
		let matches;
		// if we have a match we can write it down
		matches = regexp.exec(data);
		if ( matches !== null){
			//if current step has changed, send partial data to client
			if (currentStep !== matches[2]){
				currentStep = matches[2];
				
				let temp ={
						"maximum_steps": matches[3],
						"current_step" : matches[2],
						"step_name" : matches[1],
						"estimated_time" : matches[5] + matches[6]
						};
				// \n\n is important to denote data packed it ended
				console.log("Sending partial data to client:" + JSON.stringify(temp));	
				res.write("data:" + JSON.stringify(temp) + "\n\n");
			}	
		}
			//console.log("step: " + matches[1] + " " +  matches[2] + "/" + matches[3] + "estimated time:" + matches[5] + matches[6]);
	}
	

	//adding handler on exit :)

	child.on('exit', (code) => {
	console.log("Exited simcraft with code: " + code);
	if (code === 0){
	console.log("Generated: " + file );
	console.log("Generated: " + json );
	// move the file to the right folder because renderer will search in /views/
	fs.renameSync('/simc/web/' + file,'/simc/web/views/' + file, (err) => {
		if (err){
		 	throw err;
			console.log(err);
		}else console.log('Moved file to /views/');
	});
	fs.renameSync('/simc/web/' + json,'/simc/web/views/' + json, (err) => {
		if (err){
			throw err;
			console.log(err);
		}else console.log('Moved json to /views/');
	});


	// send .html to client
	console.log("Serving report to client..");
	//dis is 4html 4Head
	// res.render(file);
	fs.readFile("/simc/web/views/" + json, (err,d)=>{
                        if (err) res.send(err);
                        let obj = JSON.parse(d);
			console.log("Sending the final packet containing the simc json");
			res.write("data:" + JSON.stringify(obj) + "\n\n");
			res.end();
        });
	
	//TODO: upload json to databse with charname and last sim date, and git revision
	// if (charAlreadySimmed not a long time ago)
	//       serve the json
	// if charalreadysimmed but too long ago
	//       sim again, upload to db
        // if char IS BEING simmed, wait for the other simulation to run and serve results

	// remove the html file 
	fs.unlink('/simc/web/views/' + uuid + '.html', (err) => { 
			if (err) throw err;
			else console.log('File removed from /views/');
			});
	

	console.log("Simulation request successfully processed!");
		// if exception comes from the command, it will have stderr
		// if stderr contains Char not found, we redirect it to the main page forsenE
		//TODO: api call myself with ajax to see if char exist :)

	}else{
		//let temp = "data: exited simc with status code: " + code + "\n\n";
		let temp = "data: " + stderr[0] + "\n\n";
		res.send(temp);
		res.end();
		console.log(stderr[0]);
	}
	}); // end on exit
};
	lul();
});

// set GET (and not middleware) to capture every route that's not a character route
// OMEGA redundant with ajax. BUT it's also useful is some 140iq man uses ajax to acces a retarded route
app.get('*',function(req,res,next){
	//res.send('TriSad');
	res.render("index.html");
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
				console.log("Application listening to port 80!\n\nOops! It appears you are running this node application through docker. The application will be available at host:externalport");

		}else{
			console.log("Application ready to listen on port 80");
		}
	});
