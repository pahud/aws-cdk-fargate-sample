import { App, Construct, Stack, StackProps } from '@aws-cdk/core';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as ecs from '@aws-cdk/aws-ecs';
import * as patterns from '@aws-cdk/aws-ecs-patterns';


export interface FargateServiceProps {
  readonly vpc?: ec2.IVpc;
}

export class FargateService extends Construct {
  constructor(scope: Construct, id: string, props: FargateServiceProps = {} ){
    super(scope, id)

    const vpc = props.vpc ?? new ec2.Vpc(this, 'Vpc', { natGateways: 1 });
    const cluster = new ecs.Cluster(this, 'Cluster', { vpc })
    const taskDefinition = new ecs.FargateTaskDefinition(this, 'Task', {
      cpu: 256,
      memoryLimitMiB: 512,
    })
    const flask = taskDefinition.addContainer('flask', { 
      image: ecs.ContainerImage.fromRegistry('pahud/flask-docker-sample:latest'),
      environment: {
        PLATFORM: 'AWS Fargate',
      }
    })
    flask.addPortMappings({ containerPort: 80 })
    new patterns.ApplicationLoadBalancedFargateService(this, 'Service', {
      taskDefinition,
      cluster
    })
  }
}

export class MyStack extends Stack {
  constructor(scope: Construct, id: string, props: StackProps = {}) {
    super(scope, id, props);

    // force use_default_vpc=1
    this.node.setContext('use_default_vpc', '1');
    new FargateService(this, 'FargateService', {
      vpc: getOrCreateVpc(this),
    })
  }
}

function getOrCreateVpc(scope: Construct): ec2.IVpc {
  // use an existing vpc or create a new one
  return scope.node.tryGetContext('use_default_vpc') === '1' ?
    ec2.Vpc.fromLookup(scope, 'Vpc', { isDefault: true }) :
    scope.node.tryGetContext('use_vpc_id') ?
      ec2.Vpc.fromLookup(scope, 'Vpc', { vpcId: scope.node.tryGetContext('use_vpc_id') }) :
      new ec2.Vpc(scope, 'Vpc', { maxAzs: 3, natGateways: 1 });
}

// for development, use account/region from cdk cli
const devEnv = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

const app = new App();

const stackName = app.node.tryGetContext('stackName') || 'cdk-fargate-service-demo-stack'

new MyStack(app, stackName, { env: devEnv });
// new MyStack(app, 'my-stack-prod', { env: prodEnv });

app.synth();
