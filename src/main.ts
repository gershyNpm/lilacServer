import '@gershy/clearing';
import { Flower, Garden, PetalTerraform, regions as awsRegions, Soil, type AwsRegionTerm } from '@gershy/lilac';
import phrasing from '@gershy/util-phrasing';
import * as tf from './util/terraform.ts';
import * as aws from './util/aws.ts';
import proc from '@gershy/nodejs-proc';
import { ECRClient, GetAuthorizationTokenCommand, ListImagesCommand } from '@aws-sdk/client-ecr';
import paging from './util/paging.ts';
import { rootFact, tempFact } from '@gershy/disk';
import scriptBundle from '@gershy/script-bundle';
import codecParse from '@gershy/util-codec-parse';
import { Pollen, type PollenInp } from '@gershy/pollen';
import { PollenHttp } from '@gershy/pollen-http';
import type { HttpMethod } from '@gershy/util-http';

// HEEERE1
// - Note the global process symbol changed - it's a garden now, not just a service map!
// - ServerCluster should write its bundle to `literal/serverCluster` following lambda's example
// - Gershy unit for image builds (seems like docker is the only way)
//   - Simply tag images with hash (same hashing strategy as lambda), and "latest"
// - Test most basic ECR upload - grow a garden with ad-hoc terraform
// - There's starting to be a lot of Z-Z-Zs floating around, pls handle
// - Deleted lilac's readme.caller.md - should probably write a readme.pollen.md explaining how
//   service map and flower id work together, are generated / consumed!

type ClusterPollenFlyInp = never
  | { op: 'make' }
  | { op: 'list' }
  | { op: 'view', id: string }
  | { op: 'join', id: string };
type ClusterPollenFlyOut<Inp extends ClusterPollenFlyInp> = 0 extends 1 ? never
  : Inp['op'] extends 'make' ? Server
  : Inp['op'] extends 'list' ? Server[]
  : Inp['op'] extends 'view' ? Server
  : Inp['op'] extends 'join' ? ServerPollen
  : never;
export class ClusterPollen extends Pollen<{ region: string, name: string, client: ECRClient }> {
  
  protected stockClient: null | ECRClient;
  constructor(inp: PollenInp<`awsFargate/${string}`> & { stockClient?: ECRClient }) {
    super(inp);
    this.stockClient = inp.stockClient ?? null;
  }
  
  public async sanitizeDef(def: unknown) {
    
    const { region, name } = codecParse({ type: 'rec', loose: true, props: {
      region: { type: 'enum', opts: awsRegions.map(r => r.term) },
      name: { type: 'str' }
    }} as const, def);
    
    const client = await (async () => {
      
      if (this.stockClient) {
        const reg = this.stockClient.config.region;
        if (region === (cl.inCls(reg, Function) ? await reg() : reg)) return this.stockClient;
      }
      
      return new ECRClient({ region }); // TODO: creds?? And what about other sanitizeDef creds - are they being passed correctly? Should they be in server map?????
      
    })();
    
    return { region, name, client };
    
  }
  
  public async fly<Inp extends ClusterPollenFlyInp>(inp: Inp): Promise<ClusterPollenFlyOut<Inp>> {
    throw Error('script missing');
  }
  
  protected getJsfnHoist() { return `${import.meta.filename}::{${this.constructor.name}}` as const; }
  protected getJsfnInp() { return {}; }
  
};

type Server = {
  
  id: string,   // fargate task id
  name: string, // ZZZ name??
  utcMs: number,
  
  network: {
    addr: string, // addressable public url
    port?: number,
    http?: { path?: string[], method?: HttpMethod }
  }
  
};

type ServerPollenFlyInp = never
  | { op: 'join' }
  | { op: 'send', msg: Json }
  | { op: 'exit' };
type ServerPollenFlyOut<Inp extends ServerPollenFlyInp> = 0 extends 1 ? never
  : Inp['op'] extends 'join' ? 'ZZZ'
  : Inp['op'] extends 'send' ? 'ZZZ'
  : Inp['op'] extends 'exit' ? 'ZZZ'
  : never;
export class ServerPollen extends Pollen<{ client: PollenHttp }> {
  
  protected clusterId: string;
  
  constructor(inp: PollenInp<`domain/${string}`> & { clusterId: string }) {
    super(inp);
    this.clusterId = inp.clusterId;
  }
  
  public async sanitizeDef(def: unknown): Promise<{ client: PollenHttp; }> {
    
    const { addr, port = null, http = null } = codecParse({ type: 'rec', loose: true, props: {
      // TODO: this http-validating codec is getting duplicated a fair bit...
      addr: { type: 'str', map: v => v as `${string}.${string}` },
      port: { req: false, type: 'num' },
      http: { req: false, type: 'rec', loose: true, props: {
        path: { req: true, type: 'arr', item: { type: 'str' } },
        method: { req: false, type: 'enum', opts: [ 'head', 'get', 'post', 'put', 'patch', 'delete' ] }
      }}
    }} as const, def);
    
    return {
      client: new PollenHttp({
        garden: this.garden,
        flowerId: `domain/${addr}` as const,
        httpInp: {
          ...(port !== null ? { port } : {}),
          ...(http !== null ? { http } : {}),
        } as any
      })
    };
    
  }
  
  public async * notice() {
    
    // TODO: See SoktPollen.prototype.notice - any sokt-related action initializes the websocket,
    // and once initialized, inbound notices are emitted by this function
    throw Error('script missing');
    
  }
  
  public async fly<Inp extends ServerPollenFlyInp>(inp: Inp): Promise<ServerPollenFlyOut<Inp>> {
    
    // TODO: Join should result in a websocket connection...
    
    // const { client } = await this.getDef();
    throw Error('logic missing');
    
  }
  
  protected getJsfnHoist() { return `${import.meta.filename}::{${this.constructor.name}}` as const; }
  protected getJsfnInp() { return { clusterId: this.clusterId }; }
  
};

export class ServerCluster extends Flower {
  
  static getAwsServices() { return [ 'ec2', 'cloudwatch' ] as const; }
  
  protected region: AwsRegionTerm;
  protected name: string;
  protected rating: -2 | -1 | 0 | 1 | 2 | 3 | 4 | 5;
  protected launchFn: () => Promise<any> | any;                              // ZZZ TODO: Consume these!
  protected invokeFn: (inp: { state: any, inp: any }) => Promise<any> | any; // ZZZ TODO: Consume these!
  protected baseUrl:  string;
  constructor(inp: {
    garden?: Garden<any, any>,
    region?: string,
    name: string,
    baseUrl: string,
    rating: -2 | -1 | 0 | 1 | 2 | 3 | 4 | 5,
    launchFn: () => Promise<any> | any,
    invokeFn: (inp: { state: any, inp: any }) => Promise<any> | any
  }) {
    
    super(inp);
    
    if (!/^[a-z][a-zA-Z0-9]*$/.test(inp.name)) throw Error('invalid name')[cl.mod]({ name: inp.name });
    
    this.region = inp.region ?? this.garden.defaults.region ?? null;
    if (!this.region) throw Error('region missing');
    
    this.name = inp.name;
    this.baseUrl = inp.baseUrl;
    this.rating = inp.rating;
    this.launchFn = inp.launchFn;
    this.invokeFn = inp.invokeFn;
    
  }
  
  public getFlowerId() { return `awsFargate/${this.region}/${this.garden.pfx}-${this.name}/${this.garden.pfx}-${this.name}` as const; }
  
  async * computePetals() {
    
    const regionProvider = tf.provider(this.garden.defaults.region, this.region);
    const name = (n?: string) => phrasing('parts->camel', [ 'serverCluster', this.name, ...(n ? [ n ] : []) ]);
    
    const ecrRepo = new PetalTerraform.Resource('awsEcrRepository', name(), {
      ...regionProvider,
      name: `${this.garden.pfx}-${this.name}`,
      imageTagMutability: 'MUTABLE'
    });
    yield ecrRepo;

    yield new PetalTerraform.Resource('awsEcrLifecyclePolicy', name(), {
      ...regionProvider,
      repository: ecrRepo.ref('name'),
      policy: { $$json: {
        rules: [{
          // Note that our images are *always* tagged (with their source code hash)
          rulePriority: 1,
          description: 'Max 10 tagged images',
          selection: {
            tagStatus: 'tagged',
            tagPrefixList: [ '' ],
            countType: 'imageCountMoreThan',
            countNumber: 10
          },
          action: { type: 'expire' }
        }]
      }}
    });

    const taskExecRole = new PetalTerraform.Resource('awsIamRole', name(), {
      ...regionProvider,
      name: `${this.garden.pfx}-${this.name}-task-exec`,
      assumeRolePolicy: { $$json: aws.capitalKeys({
        version: '2012-10-17',
        statement: [{
          effect: 'Allow',
          action: 'sts:AssumeRole',
          principal: { service: 'ecs-tasks.amazonaws.com' }
        }]
      })}
    });
    yield taskExecRole;

    yield new PetalTerraform.Resource('awsIamRolePolicyAttachment', name(), {
      ...regionProvider,
      role: taskExecRole.ref('name'),
      policyArn: 'arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy'
    });

    yield new PetalTerraform.Resource('awsEcsCluster', name(), {
      
      ...regionProvider,
      name: `${this.garden.pfx}-${this.name}`,
      $setting: { name: 'containerInsights', value: 'enabled' }
      
    });
    
    // No capacity provider required for ad-hoc, manually-requested servers!
    // const clusterCapacityProviders = new PetalTerraform.Resource('awsEcsClusterCapacityProviders', `${this.name}Cluster`, {
    //   ...regionProvider,
    //   clusterName: cluster.ref('name'),
    //   capacityProviders: [ 'FARGATE' ], // Could add FARGATE_SPOT, but such instances may randomly be reclaimed by aws
    //   $defaultCapacityProviderStrategy: {
    //     capacityProvider: 'FARGATE',
    //     base: 1,
    //     weight: 1
    //   }
    // });
    // yield clusterCapacityProviders;
    
    const cpu = 1024 * (2 ** this.rating);
    yield new PetalTerraform.Resource('awsEcsTaskDefinition', name(), {
      
      ...regionProvider,

      // One task definition per Lilac server cluster; each launched task is a server instance.
      family: `${this.garden.pfx}-${this.name}`,
      requiresCompatibilities: [ 'FARGATE' ],
      networkMode: 'awsvpc',
      executionRoleArn: taskExecRole.ref('arn'),
      
      // `cpu` and `memory` need to be strings in terraform
      // Consider: expose more options for `memory` than just `[ cpu * 2 ]`
      ...{ cpu, memory: cpu * 2 }[cl.map](v => v.toString(10)),
      
      // Image value remains a stub for now; next step is to build/push real bundle image.
      containerDefinitions: { $$json: [{
        name: `${this.garden.pfx}-${this.name}`,
        image: `${tf.embed(ecrRepo.refStr('repositoryUrl'))}:lilac-server-stub`, // E.g. 'public.ecr.aws/docker/library/node:22-alpine'
        // command: [ ' node', '-e', 'setInterval(() => {}, 1 << 30)' ], // Don't set this - it overrides dockerfile ENTRYPOINT / CMD
        essential: true
      }]}
      
    });
    
    type ContainerImageOutput = {
      containerImage: {
        [K in `fargate/${string}`]: { tag: string, status: 'exists' | 'created' }
      }
    };
    yield new PetalTerraform.Output(name(), { repoUrl: ecrRepo.ref('repositoryUrl') }, async (inp): Promise<ContainerImageOutput> => {
      
      // ServerCluster needs a post-terraform-install action: it needs to potentially write an
      // updated image to the container registry!
      
      const { repoUrl } = inp as { repoUrl: string };
      const tag = 'lilac-server-stub';
      const ref = `${repoUrl}:${tag}`;
      const registry = repoUrl.split('/')[0]!;
      const repo = `${this.garden.pfx}-${this.name}`;
      const ecr = new ECRClient(this.garden.defaults.awsClientConfig as Soil.AwsClientConfig);
      
      // TODO: Maybe we need to `scriptBundle` and compute hash first, so we know the preexisting
      // hash to look for??
      const existingImg = await (async () => {
        
        const allImages = paging(async last => {
          
          const { nextToken: next = null, imageIds = [] } = await ecr.send(new ListImagesCommand({
            repositoryName: repo,
            filter: { tagStatus: 'TAGGED' },
            ...(last ? { nextToken: last } : {})
          }));
          return { next, page: imageIds };
          
        });
        
        for await (const img of allImages) if (img.imageTag === tag) return img;
        
        return null;
        
      })();
      
      // Image already exists - we're good
      if (existingImg) return { containerImage: {
        [`fargate/${this.region}/TODO-cluster/TODO-family`]: { tag, status: 'exists' as const }
      }};
      
      const auth = await ecr.send(new GetAuthorizationTokenCommand({}));
      const authPayload = auth.authorizationData?.[0];
      if (!authPayload?.authorizationToken) throw Error('ecr auth token missing')[cl.mod]({ auth });
      
      const [ user, pass ] = Buffer
        .from(authPayload.authorizationToken, 'base64')
        .toString('utf8')
        [cl.cut](':', 1);
      if (!user || !pass) throw Error('ecr auth token invalid')[cl.mod]({ auth });
      
      const dockerOpsFact = tempFact.kid([ Math.random().toString(36).slice(2) ]);
      await dockerOpsFact.kid([ 'note.txt' ]).setData('Temporary docker operations');
      
      if (!this.baseUrl[cl.hasHead]('file:///'))
        throw Error('non-file bundle base url invalid')[cl.mod]({ baseUrl: this.baseUrl });
      
      const fileFact = rootFact.kid([ this.baseUrl.slice('file:///'.length) ]);
      const dirFact = fileFact.par();
      const script = String[cl.baseline](`
        | // TODO: jsfn-encode everything necessary to wire up launchFn and invokeFn
        | console.log('stub! no launch or invoke fn logic here yet!');
      `);
      
      // TODO: oh the bundle should be written pre-terraform-apply to literal/... like lambda does
      // and we can later reference that file, maybe by `.refStr` to get the terraform filepath?
      // The terraform path is a naive relative path string. Can also just read the file... in
      // either case need to know where the pfx/terraform/main directory is...
      const bundle = await scriptBundle({ debug: this.garden.debug, platform: 'node/cjs', dirFact, script });
      await dockerOpsFact.kid([ 'build', 'bundle.cjs' ]).setData(bundle);
      
      const dockerEnv = {
        
        // Remove any "docker_"-prefixed env vars
        ...{ ...process.env }[cl.map]((v, k) => k[cl.lower]()[cl.hasHead]('docker_') ? cl.skip : v),
        
        // Control the docker config location
        DOCKER_CONFIG: dockerOpsFact.fsp()
        
      };
      
      try {
      
        await proc(`docker login --username {{username}} --password-stdin {{registry}}`, {
          args: { username: user, registry },
          env: dockerEnv,
          onData: async type => type === 'init' ? `${pass}\n` : null
        });
        
        await dockerOpsFact.kid([ 'Dockerfile' ]).setData(String[cl.baseline](`
          | FROM public.ecr.aws/docker/library/node:22-alpine
          | WORKDIR /app
          | COPY bundle.cjs /app/bundle.cjs
          | CMD ["node", "/app/bundle.cjs"]
        `));
        await proc(`docker build -t {{imageRef}} -f {{dockerfile}} {{buildContext}}`, {
          args: {
            imageRef: ref,
            dockerfile:   dockerOpsFact.kid([ 'Dockerfile' ]).fsp(),
            buildContext: dockerOpsFact.kid([ 'build'      ]).fsp()
          },
          env: dockerEnv
        });
        
        await proc(`docker push {{imageRef}}`, { args: { imageRef: ref }, env: dockerEnv });

      } finally { await dockerOpsFact.rem(); }
      
      return { containerImage: {
        [`fargate/${this.region}/TODO-cluster/TODO-family`]: { tag, status: 'exists' as const }
      }};
      
    });
    
  }
  
  public addPollen() {
    // TODO: Lambdas should be able to call this too! Need to pass them, track them in an array,
    // and generate iam permissions for them in `computePetals`
    return new ClusterPollen({ garden: this.garden, flowerId: this.getFlowerId() });
  }
  
};
