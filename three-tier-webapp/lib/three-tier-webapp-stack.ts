import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as targets from 'aws-cdk-lib/aws-route53-targets';
import * as autoscaling from 'aws-cdk-lib/aws-autoscaling';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
// import * as sqs from 'aws-cdk-lib/aws-sqs';

export class ThreeTierWebappStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const vpc = new ec2.Vpc(this, 'a-webapp-vpc', {
      natGateways: 0,
      ipAddresses: ec2.IpAddresses.cidr('172.30.0.0/16'),
      ipProtocol: ec2.IpProtocol.DUAL_STACK,
    });

    const albSG = new ec2.SecurityGroup(this, "alb-sg", {
      vpc: vpc
    });

    const appServerSG = new ec2.SecurityGroup(this, "app-server-sg", {
      vpc: vpc
    })

    albSG.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.HTTP);
    albSG.addIngressRule(ec2.Peer.anyIpv6(), ec2.Port.HTTP);
    albSG.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.HTTPS);
    albSG.addIngressRule(ec2.Peer.anyIpv6(), ec2.Port.HTTPS);
    albSG.addEgressRule(ec2.Peer.securityGroupId(appServerSG.uniqueId), ec2.Port.tcp(8080))

    appServerSG.addIngressRule(ec2.Peer.securityGroupId(albSG.uniqueId), ec2.Port.tcp(8080))

    const alb = new elbv2.ApplicationLoadBalancer(this, "a-webapp-alb", {
      vpc: vpc,
      internetFacing: true,
      securityGroup: albSG
    });

    const port80Listner = alb.addListener('a-webapp-port-80', {
      port: 80
    });

    const port443Listner = alb.addListener('a-webapp-port-443', {
      port: 443
    });

    const aWebappZone = new route53.HostedZone(this, "a-webapp-hosted-zone", {
      zoneName: "liyumapp.com"
    })

    const aRecord = new route53.ARecord(this, 'webapp-a-record', {
      zone: aWebappZone,
      recordName: 'dev',
      target: route53.RecordTarget.fromAlias(new targets.LoadBalancerTarget(alb))
    })

    const appServerTemplate = new ec2.LaunchTemplate(this, 'app-server-template', {
      machineImage: ec2.MachineImage.genericLinux({"us-east-2": "ami-03bfe38a90ce33425"}),
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T2, ec2.InstanceSize.MICRO),
      securityGroup: appServerSG
    });

    const appServerASG = new autoscaling.AutoScalingGroup(this, 'app-server-asg', {
      vpc: vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS
      },
      desiredCapacity: 1,
      minCapacity: 0,
      maxCapacity: 2,
      launchTemplate: appServerTemplate,
    });

    port80Listner.addTargets('a-webapp-servers', {
      port: 8080,
      targets: [appServerASG]
    });

    port443Listner.addTargets('three-t-webapp', {
      port: 8080,
      targets: [appServerASG]      
    })
  }
}
