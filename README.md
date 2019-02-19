# Simcraft

A docker container based on [Simcraft CLI](https://github.com/simulationcraft/simc) (simc) , with a small web interface to display results.

## Getting Started

These instructions will cover usage information and for the docker container 

### Prerequisities


In order to run this container you'll need docker installed.

* [Windows](https://docs.docker.com/windows/started)
* [OS X](https://docs.docker.com/mac/started/)
* [Linux](https://docs.docker.com/linux/started/)

### Usage

#### Container Parameters


```shell
docker run -d -p 8080:80 -e CLIENT_ID <YOUR_CLIENT_ID> -e CLIENT_SECRET <YOUR_CLIENT_SECRET> devolution2409/simcraft:latest
```

or, if you're feeling adventurous:
```shell
docker run -d -p 8080:80 -e CLIENT_ID <YOUR_CLIENT_ID> -e CLIENT_SECRET <YOUR_CLIENT_SECRET> devolution2409/simcraft:nightly 
```
#### How to get CLIENT ID and CLIENT SECRET from Blizzard Api

(Taken from: [simcraft wiki](https://github.com/simulationcraft/simc/wiki/BattleArmoryAPI))

Client credentials can be obtained by going to the Battle.Net Dev Website.

Registering a key is incredibly easy.

1. Sign in with a Battle.net account with two-factor authentication enabled
2. Click "API ACCESS" at the top-left of the page
3. Click on the "Create new client"
4. The only required field on the key registration is the name of the application, choose a globally unique name
5. Click create, it will take you to the credential information page
6. Copy/Paste the 32-character client id into Simulationcraft GUI under "Options" "Globals" "Advanced Settings"
7. Copy/Paste the 32-character client secret into Simulationcraft GUI under "Options" "Globals" "Advanced Settings"

#### Environment Variables

* `CLIENT_ID` - Client ID of your Blizzard API App
* `CLIENT_SECRET` - Client Secret of your Blizzard API App

## Dockerfile

```Dockerfile

FROM frolvlad/alpine-gxx

RUN apk add git && git clone https://github.com/simulationcraft/simc.git

RUN apk add make && apk add curl-dev 

WORKDIR /simc/engine

RUN make optimized

ENV CLIENT_ID=<YOUR CLIENT ID HERE>
ENV CLIENT_SECRET=<YOUR CLIENT SECRET HERE>

RUN apk add --update nodejs npm

WORKDIR /simc/web

RUN echo $CLIENT_ID:$CLIENT_SECRET >> apikey.txt

RUN npm install --save express ejs await-exec

COPY ./index.js /simc/web

RUN mkdir views

CMD ["node","index.js"]

```

## Built With

* Alpine Linux
* g++ version 8.2.0 (Alpine 8.2.0)
* node v10.14.2 (packages: express, ejs, async-exec)

## TODO

* Proper check with api to see if character exists before allowing the sim to take place
* add a check for req.xhr in get, so that it's only available from ajax, and redirects to the main page if not ajax.
	 if (ajax){
              if (charExist) (check via smol api call){
                 simulate()
                 serveResult()
              }else{
                 reply = char doesn't exist, so we can update page accordingly
              }
 	 }else{
             redirect to /
	 }
* Also, try to setup the output format as json and serve a very nice page with chart.js and shit, with a link to the html generated by simc aswell 
* Set up a folder for each simulation that has taken place, and delete it with a time, or if the character armory page has been updated, (check for blizz api if there's a last update key somewhere, and store it along side the nickname in a database)
* ~~Add a front page allowing to request a sim~~
*  and add several options to it (stats weight etc)
* Add a timeout of 1 hour cache on full report route
* ~~Reduce the number of iteration because 1M is a fucking lot~~
* actually, target_error takes care of that

* Finish implementing the css classes for the colored border
* ~~Implement talent~~
* ~~Correct items ilvl~~
* Correct item quality


## Find Us

* [GitHub](https://github.com/devolution2409/simcraft)

## Versioning

We use [SemVer](http://semver.org/) for versioning. For the versions available, see the 
[tags on this repository](https://github.com/devolution2409/simcraft/tags). 

## Authors

* **Devolution** - *Initial work* 

See also the list of [contributors](https://github.com/devolution2409/simcraft/contributors) who 
participated in this project.

## License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details.

## Acknowledgments

* The guys from simcraft :)
* BAJS and PAJLADS 
