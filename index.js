// requiring everything we need
let express = require('express');
let fs = require('fs');
let app = express();
let Diff = require('diff');
const { spawn } = require('child_process');
const axios = require('axios');
const oauth = require('axios-oauth-client');


// checking if the variables were set, if they weren't, we serve a page saying they weren't.. DUH
if (!process.env.CLIENT_ID || !process.env.CLIENT_SECRET ||
		process.env.CLIENT_ID=="<YOUR CLIENT ID>" || process.env.CLIENT_SECRET=="<YOUR CLIENT SECRET>"){
	console.log("Environnement variables CLIENT_ID and CLIENT_SECRET weren't set. Unable to contact Blizzard API.\nThe procedure to obtain them is described on the following page: https://github.com/devolution2409/simcraft/README.md");

	app.use('*', function(req,res){
		res.send("Environnement variables CLIENT_ID and CLIENT_SECRET weren't set. Unable to contact Blizzard API.\nThe procedure to obtain them is described on the following page: https://github.com/devolution2409/simcraft/README.md");

	});

}else{

	// array to contain simulation that are already running
	let runningSims = {};

	//allowing public folder to be fetched
	app.use("/static", express.static('static'));
	app.use("/static/images",express.static('static/images'));

	// defined a function to get access token to perform requests
	// https://develop.battle.net/documentation/guides/using-oauth/client-credentials-flow
	let GetCredentials = async function () {
		const GetAuthorizationCode = oauth.client(axios.create(), {
			url: 'https://us.battle.net/oauth/token',
			grant_type: 'client_credentials',
			client_id: process.env.CLIENT_ID,
			client_secret: process.env.CLIENT_SECRET
		});

		let auth = await GetAuthorizationCode();
		return new Promise ( (resolve,reject) => {
			resolve(auth);
		});
	};



	// setting default render engine to htlm (need ejs)
	app.set('view engine', 'html');
	app.engine('html', require('ejs').renderFile);

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



	app.get(/\/(EU|NA|KR|TW)\/\w+\/\w+\/check_existence/i,function(req,res,next){
		//      https://eu.api.blizzard.com/wow/character/suramar/devolution?locale=en_US&access_token=USXheV5m0buDLGJpSz1Bk1YSOD51bwEtcR
		GetCredentials().then( (auth) => {
			let path = req.originalUrl.substring(1).split('/');
			let accessToken = auth.access_token;         
			let url = "https://" + path[0] + ".api.blizzard.com/wow/character/" + path[1] + "/" + path[2] + "?fields=talents,items&locale=en_US&access_token=" + accessToken;
			axios.get(url,{         
				headers: {                                 
					'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
				}                                  
			})                         
			.then( (response) => {            
				res.json(response.data);
				res.end();
				//console.log(response.data);
			})                              
			.catch( (err) => {                
				res.json(err.response.data);
				//console.log(err.response.data);
			});
		});
	});
	//  actually fuck ajax, SSE is better forsenE
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
		let uuid, file, json, stdoutFilename, stderrFilename;

		if (runningSims.hasOwnProperty(infos[2])){
			res.write(`data: Simulation for ${infos[2]} already running. Results will be sent. \n\n`);
			uuid = runningSims[infos[2]];	
		}else{
			//generating random name for the file
			uuid = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
		}
		// removing empty / (trailing / for instance)
		//var filtered = infos.filter(Boolean);
		

		file = uuid + '.html';
		json = uuid + '.json';
		stdoutFilename = uuid + '.stdout';
		stderrFilename = uuid + '.stderr';
		let armoryString =  "armory=" + infos[0] + "," + infos[1] + "," + infos[2];
		let opts = [];
		if (infos.length > 3)
			opts = infos.splice(3);
		//console.log(opts);

		let normalize = (param,value) =>{
			if (param == 'target_error'){
				if (value > 0.2)
					return 0.2;
				else if (value < 0.05)
					return 0.05;
				return value;
			} 
			if (param == 'iterations'){
				if (value > 1000000)
					return 1000000;
				else if (value < 5000)
					return 5000;
				return value;
			}
			return value;

		};		

		let params = [armoryString] ; // ,"target_error=0.05","iterations=10000","fight_style=patchwerk","calculate_scale_factors=1"];
		let patterns = [/(target_error)=(\d+)/gi,/(iterations)=(\d+)/gi,/(fight_style)=(\w+)/gi];
	let foundOpts = [];	
		opts.forEach( (el) => {
			
				// some stops iterating when we return true
				patterns.some ( (rx) => {
					let temp = rx.exec(el);
					if (temp != null){
						console.log(temp);
						params.push(temp[1] + '=' + normalize(temp[1],temp[2]));
						foundOpts.push(temp[1]);
					}

					
				});


		}, this);
					//setting default params
					if (foundOpts.indexOf('target_error') == -1)
						params.push('target_error=0.1');
					if (foundOpts.indexOf('iterations') == -1)
						params.push('iterations=10000');
					if (foundOpts.indexOf('fight_style') == -1)
						params.push('fight_style=patchwerk');
	
		// setting report output to json
		params.push("json2=" + json);
		// generate the html in case
		params.push("html=" + file);
		// we want to set stdout to file in any case
		params.push(">temp/" + stdoutFilename);
		// and stderr 
		params.push("2>temp/" + stderrFilename);

		// variable function here because we need async to be able to await the response before sending it
		var lul = async function(){
			// calculate_scale_factors=1 requires at least >10000 iterations
			
				//const child = spawn ( "../engine/simc", [armoryString,"target_error=0.05","html=" + file,"json=" + json,"calculate_scale_factors=1","iterations=10000","fight_style=patchwerk"]);

				// if simluation ISNT already running we spawn the process
				// and add it to the runningSims object
				if (!runningSims.hasOwnProperty(infos[2])){
					//const child = spawn ( "../engine/simc", [armoryString,"target_error=0.05","html=" + file,"json=" + json,"iterations=10000","fight_style=patchwerk","calculate_scale_factors=1",">temp/" + stdoutFilename ,"2>temp/" + stderrFilename],{shell:true});
					const child = spawn ( "../engine/simc",params,{shell:true});
					res.write('data: ' + JSON.stringify(params) + ' \n\n');
					runningSims[infos[2]] = uuid;
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

						}else{
							//let temp = "data: exited simc with status code: " + code + "\n\n";
							let msg = { error: stderr[0]};
							let temp = "data: " + JSON.stringify(msg) + " \n\n ";
							res.send(temp);
							res.end();
							console.log(stderr[0]);
						}
						// in any case, this sim has exited so we must removve it frmo the ruunnig sim arays
						delete runningSims[infos[2]];	
					}); // end on exit

				}

			let currentStep = 0;
			let stderr = [];
			let prevData ='';
			fs.watchFile("temp/" + stdoutFilename,function(){
				let currData = fs.readFileSync('temp/' + stdoutFilename, 'utf8');	
				let diff =	 Diff.diffLines(prevData,currData);
				let data = '';
				diff.forEach(function(part){
					//process.stdout.write('\033c');
					//console.log(part.value);
					data = part.value;
				});
				prevData = currData;	


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
			}); // end fs.watch
			//adding handler on exit :)


		} //end lul defintion
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
