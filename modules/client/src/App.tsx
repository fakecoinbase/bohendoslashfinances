import React, { useState, useEffect } from 'react';

import {
  AssetTotal,
  ChainData,
  NetGraphData,
} from "@finances/types";

import {
  AppBar,
  Container,
  CssBaseline,
  Grid,
  Theme,
  Typography,
  createStyles,
  makeStyles,
} from '@material-ui/core';

import { NetWorth } from './components/NetWorthGraph';
import { AssetDistribution } from './components/AssetDistribution';
import { DateTime } from './components/DateTimePicker'
import { EventTable } from './components/EventTable'
import { TransactionLogs } from './components/TransactionLogs'

import personal from './data/personal.json';
import chainData from './data/chain-data.json';

//import { getParsedPersonal } from './utils/parse';
import {
  getAllEvent,
  getFilteredChainData,
  getAllAssetTypes,
  getEventCategoryByAssetType,
  getNetWorthOn,
  getNetStanding,
} from './utils/getters';

import { getNetWorthData } from './utils/netWorth';

import {
  AddressBook,
  Event,
  EventByCategoryPerAssetType,
} from './types';

const useStyles = makeStyles((theme: Theme) => createStyles({
  root: {
    backgroundColor: "linen",
  },
  content: {
    flexGrow: 1,
    height: '100vh',
    overflow: 'auto',
  },
  container: {
    paddingTop: theme.spacing(4),
    paddingBottom: theme.spacing(4),
  },
  main: {
    marginTop: "80px",
  },
  title: {
    flexGrow: 1,
  },
}));

function App() {
  const classes = useStyles();
  const [endDate, setEndDate] = useState(new Date());
  const [data, setData] = useState({} as ChainData);
  const [allEvent, setAllEvent] = useState([] as Array<Event>);
  const [netWorthData, setNetWorthData] = useState({} as NetGraphData);
  const [eventByCategory, setEventByCategory] = useState({} as EventByCategoryPerAssetType);
  const [assetTypes, setAssetTypes] = useState([] as Array<string>);
  const [netStandingByAssetTypeOn, setNetStandingByAssetTypeOn] = useState([] as { assetType: string; total: number; totalUSD: number; }[])

  useEffect(() => {
    setData(getFilteredChainData(personal, chainData));
  }, []);

  useEffect(() => {
    (async () => {
      if (data) {
        let eventData = await getAllEvent(data, personal.addressBook as AddressBook)
        if (eventData) {
          setAllEvent(eventData);
          let byCategory = getEventCategoryByAssetType(eventData);
          if (byCategory) {
            setEventByCategory(byCategory);
            setAssetTypes(getAllAssetTypes(byCategory));
          }
        }
      }
    })();
  }, [data]);


  useEffect(() => {
    setNetWorthData(getNetWorthData(allEvent));
  }, [allEvent]);

  useEffect(() => {
    (async () => {
      if (endDate && netWorthData && netWorthData.netWorth) {
        let date = endDate.toISOString().slice(0,10)

        if (!netWorthData.netWorth[date]) {
          if (endDate.toISOString() > netWorthData.lastUpdated) 
            date = netWorthData.lastUpdated.slice(0,10);
          else {
            //@ts-ignore
            let nearestDate = _.findLastKey(
              netWorthData.netWorth,
              (value: AssetTotal, key: string) => key < date);
            if (nearestDate) date = nearestDate;
          }
        }

        console.log(date);

        let byAsset = await getNetStanding(
          netWorthData.netWorth[date],
          endDate.toISOString()
        );

        if (byAsset.length > 0) {
          setNetStandingByAssetTypeOn(byAsset)
        }
      }
    })();
  }, [netWorthData, endDate]);

  //console.log(allEvent)
  //console.log(eventByCategory);
  console.log(netStandingByAssetTypeOn);

  return (
    <div className={classes.root}>
      <CssBaseline />
      <AppBar position="absolute">
        <Typography component="h1" variant="h6" color="inherit" noWrap className={classes.title}>
          Dashboard
        </Typography>
      </AppBar>
      <main className={classes.content}>
        <Container maxWidth="lg" className={classes.container}>
          <Grid container spacing={3}>
            <Grid item xs={6} md={6} lg={6}>
              <Typography>
                Account Overview
              </Typography>
            </Grid>
            <Grid item xs={6} md={6} lg={6}>
              <DateTime date={endDate} label="View Net Worth As of" setDate={setEndDate}/>
            </Grid>
            <Grid item xs={6} md={6} lg={6}>
              <Typography>
                Net Worth
              </Typography>
            </Grid>
            <Grid item xs={6} md={6} lg={6}>
              <Typography>
                $ {getNetWorthOn(netStandingByAssetTypeOn)}
              </Typography>
            </Grid>
            <Grid item xs={12} md={8} lg={9}>
              <NetWorth allEvent={allEvent} endDate={endDate.toISOString()}/>
            </Grid>
            <Grid item xs={12} md={4} lg={3}>
              <AssetDistribution netStandingByAssetTypeOn={netStandingByAssetTypeOn}/>
            </Grid>
            <Grid container>
              <TransactionLogs allEvent={allEvent} />
            </Grid>
            <Grid item xs={12} md={12} lg={12}>
              <EventTable eventByCategory={eventByCategory} assetTypes={assetTypes} netStandingByAssetTypeOn={netStandingByAssetTypeOn} endDate={endDate.toISOString()}/>
            </Grid>
          </Grid>
        </Container>
      </main>
    </div>
  );
}

export default App;