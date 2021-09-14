
# B.Protocol
The BAMM (bprotocol automatic market maker)
provides automatic rebalancing over Liquity's stability pool.

it will swap your ETH with LUSD automaticly after the stabilty pool preforms a liquidation,
this will maximize your LQTY gains as the stability pool only rewards LUSD deposits

## integrating the BAMM with existing Liquity frontends and interfaces
any existing LQTY front end can integrate the BAMM into their interface to gain extra fees from the rebalancing process,
read more to learn about the verious integration options

1) integrating directly with the smart contract like [pickle.finance](https://app.pickle.finance/farms) did

2) Front-End intgration using our widgets and snipets, 
the quicker & simpler approch

## BAMM front-end integration
there are sevral ways to integrate our front-end with your exsiting front end and we will demonstrate a few options.

1) integrate our front end as a widget into an exsiting page or modal window. 
    1) in this example our widget in red border inside the original liquity app [widget example](https://integration-example-3.bprotocol.workers.dev)

1) integrate our front-end as a page in your exsiting app. 
     1) click on the red B.PROTOCOL navigation link to see our widget in red border as a page of the original liquity app [page example](https://integration-example-1.bprotocol.workers.dev/)

1) integrate our front-end as a separate single page application linked to your website  
     1) click on the red B.PROTOCOL navigation link to see the SPA on the same domain using the same meta mask connection [seperate singel page application example](https://integration-example-2.bprotocol.workers.dev/)

### steps to integrate our front-end in your exsiting app
1) git clone the repo
2) install and compile all TS files run ```yarn install```
5) find mainnet.json addresses file change the BAMM address in to your version of the BAMM contract
6) ```cd packages/dev-frontend```
6) run ```yarn start``` to test that the app is working as expected.
7) in package.json change "homepage" property to what ever directory name you wish to serve our widget from
8) ```yarn build```
9) upload the contents of the build folder to your website/app hosting under the directory you chose as the "homepage"
10) use one of these snipets to embad in your website/app

    1) page in app: ```<iframe height="800px" width="100%" src="/"homepage"?hideNav=true" style="border: 2px solid red;"></iframe>```
    2) widget: ```<iframe height="800px" width="100%" src="/"homepage"?widget=true" style="border: 2px solid red;"></iframe>```
    3) or a simple link: ```<a href="homepage">bamm</a>```

for questions or other integration options please reach out on our [Discord channel](https://discord.com/invite/bJ4guuw)


