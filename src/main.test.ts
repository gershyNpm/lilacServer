import './main.ts';
import { assertEqual, testRunner } from '../build/utils.test.ts';
import { ServerCluster } from './main.ts';
import { entry } from '@gershy/entry';
import '@gershy/clearing';
import { Garden, Soil } from '@gershy/lilac';
import { rootFact, tempFact, type Fact } from '@gershy/disk';

const codec = { type: 'rec', props: {
  reg:    { type: 'str', map: (str: string) => new RegExp(str) },
  effort: { type: 'enum', opts: [ 0, 1, 2, 3, 4, 5, 6 ] },
  aws:    { req: false, type: 'rec', props: {
    region: { type: 'str' },
    auth: { type: 'rec', props: {
      id: { type: 'str' },
      '!secret': { type: 'str' },
    }}
  }}
}} as const;
entry({ name: 'lilacServer', codec, inp: { reg: '^', effort: 0 }, fn: async (logger, { reg, effort, ...inp }) => {
  
  // Type testing
  (async () => {
    
    type Enforce<Provided, Expected extends Provided> = { provided: Provided, expected: Expected };
    
    type Tests = {
      1: Enforce<{ x: 'y' }, { x: 'y' }>,
    };
    if (0) ((v?: Tests) => void 0)();
    
  })();
  
  const isolated = async (fn: (fact: Fact) => Promise<void>) => {
    
    let fact: null | Fact = null;
    try {
      
      fact = await rootFact.kid([ import.meta.dirname, '.isolated' ], { newTx: true });
      await fn(fact);
      
    } finally {
      
      await fact?.rem();
      fact?.tx.end();
      
    }
    
  };
  
  await testRunner({ logger, reg, effort, inp, cases: [
    
    { name: 'basic aws', fn: async (logger, inp) => isolated(async fact => {
      
      if (1) return void logger.log({ $$: 'ZZZ skipperooni' });
      
      if (!inp.aws) return void logger.log({ $$: 'skipped', aws: null });
      
      const garden = new Garden({
        
        logger,
        pfx: 'lilacServerBasicTest',
        infraFact: fact.kid([ 'repo', 'terraform' ]),
        patioFact: fact.kid([ 'repo', 'patio' ]),
        shedFact: tempFact.kid([ '@gershy' ]),
        seedBank: { ServerCluster },
        survey: (garden, flowers, add) => {
          
          const { ServerCluster } = flowers;
          
          const cluster = add(new ServerCluster({
            name: 'test',
            baseUrl: import.meta.filename,
            rating: 0,
            launchFn: async () => {
              const state = { count: 0 };
              setInterval(() => state.count++, 1000);
              return state;
            },
            invokeFn: async (inp: { state: { count: number }, inp: any }) => {
              return {
                taskState: inp.state,
                echo: inp.inp
              };
            }
          }));
          
          return { clusterPollen: cluster.addPollen() };
          
        }
        
      });
      
      const soil = new Soil.AwsCloud({ logger, garden, auth: inp.aws.auth });
      const { rake, ornaments } = await garden.grow(soil);
      
      try {
        
        const { clusterPollen } = ornaments;
        const server = await clusterPollen.fly({ op: 'make' });
        const serverPollen = await clusterPollen.fly({ op: 'join', id: server.id });
        const notice = serverPollen.notice();
        
        assertEqual(
          await serverPollen.fly({ op: 'send', msg: { msg: 'test msg #1' } }),
          {
            state: { count: 20 }, // Lol 20 is nondeterministic
            echo: { msg: 'test msg #1' }
          }
        );
        assertEqual(
          await serverPollen.fly({ op: 'send', msg: { msg: 'test msg #2' } }),
          {
            state: { count: 21 }, // Lol 21 is nondeterministic
            echo: { msg: 'test msg #2' }
          }
        );
        
        await serverPollen.fly({ op: 'exit' });
        
        // Note notices received in this test
        assertEqual(await notice[cl.toArr](v => v), []);
        
      } finally { await rake(); }
      
    })}
      
  ]});
  
}});