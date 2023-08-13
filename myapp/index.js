const express = require("express");
const axios = require("axios");
const https = require('https');



const app = express();
const VCAP_SERVICES = JSON.parse(process.env.VCAP_SERVICES);
const destSrvCred = VCAP_SERVICES.destination[0].credentials;
const conSrvCred = VCAP_SERVICES.connectivity[0].credentials;
const sDestinationName = 'AS4CLNT400';


const PORT = process.env.PORT || 5000;

app.get('/helloworld', async(req,res) => {
    console.log('Log ' + 'Call Destination Service')  
    const a = "/sap/opu/odata/SAP/ZGW_ERP_ISU_UMC_SRV_01/Contracts?$filter=(ContractAccountID eq '" +  "002300000230" + "' " 
    res.send('Hello World')  
    console.log('Hello World');
})

app.get('/callonprem', async(req,res) => {
    const destJwtToken = await _fetchJwtToken(destSrvCred.url, destSrvCred.clientid, destSrvCred.clientsecret)
    const destiConfi = await _readDestinationConfig(sDestinationName, destSrvCred.uri, destJwtToken)

    // call onPrem system via connectivity service and Cloud Connector
    const connJwtToken = await _fetchJwtToken(conSrvCred.token_service_url, conSrvCred.clientid, conSrvCred.clientsecret)    
    const result =  await _callOnPrem(conSrvCred.onpremise_proxy_host, conSrvCred.onpremise_proxy_http_port, connJwtToken, destiConfi)
    res.send(result)
})

const _fetchJwtToken = async(oauthUrl, oauthClient, oauthSecret) => {
    const agent = new https.Agent({  
        rejectUnauthorized: false
      });    
    const tokenUrl = oauthUrl + '/oauth/token?grant_type=client_credentials&response_type=token'  
    const config = {
        headers: {
           Authorization: "Basic " + Buffer.from(oauthClient + ':' + oauthSecret).toString("base64")
        },
        httpsAgent: agent
    }
    try {
        let response = await axios(tokenUrl,config)  
        let result = await response.data.access_token
        return(result)        
    } catch (error) {
        console.log("Error : " + error )
    }   
}

const _readDestinationConfig = async(destinationName, destUri, jwtToken) => {
    const agent = new https.Agent({  
        rejectUnauthorized: false
      });    
    const destSrvUrl = destUri + '/destination-configuration/v1/destinations/' + destinationName  
    const config = {
        headers: {
           Authorization: 'Bearer ' + jwtToken
        },
        httpsAgent: agent    
    }
    try {
        let response = await axios(destSrvUrl,config)  
        let result = await response.data.destinationConfiguration
        return(result)        
    } catch (error) {
        console.log("Error : " + error )
    }     
}


const _callOnPrem = async(connProxyHost, connProxyPort, connJwtToken, destiConfi) => {
    const agent = new https.Agent({  
        rejectUnauthorized: false
      });    
    const targetUrl = destiConfi.URL + "/sap/opu/odata/SAP/ZGW_ERP_ISU_UMC_SRV_01/ContractAccounts?$filter=(AccountID eq '" +  "1000002565" + "')" 
    const encodedUser = Buffer.from(destiConfi.User + ':' + destiConfi.Password).toString("base64")    

    const config = {
        headers: {
            Authorization: "Basic " + encodedUser,
            'Proxy-Authorization': 'Bearer ' + connJwtToken,
            'SAP-Connectivity-SCC-Location_ID': destiConfi.CloudConnectorLocationId
        },       
        proxy: {
            host: connProxyHost, 
            port: connProxyPort 
        },
        httpsAgent: agent                           
    }    


    try {
        let response = await axios(targetUrl,config)  
        let result = await response.data
        const stringData = JSON.stringify(result.d.results[0]);
        return(stringData)        
    } catch (error) {
        console.log("Error : " + error )
        const stringData = JSON.stringify(error);
        return(stringData)
    }     
}





app.listen(PORT,() => {
    console.log(`Listening on Port http://localhost:${PORT}`)
})