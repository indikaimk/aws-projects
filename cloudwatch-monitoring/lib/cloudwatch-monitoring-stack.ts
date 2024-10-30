import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as cw from 'aws-cdk-lib/aws-cloudwatch'
// import * as sqs from 'aws-cdk-lib/aws-sqs';

export class CloudwatchMonitoringStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const vpc = new ec2.Vpc(this, "web-app-with-cloudwatch", {
      natGateways: 0,
      ipAddresses: ec2.IpAddresses.cidr("172.29.0.0/16"),
      ipProtocol: ec2.IpProtocol.DUAL_STACK 
    })

    const wesServer = new ec2.Instance(this, "web-server", {
      vpc: vpc,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.MICRO),
      machineImage: ec2.MachineImage.genericLinux({"us-east-2": "ami-03bfe38a90ce33425"})
    })

    // const cwAlarm = new cw.Alarm(this, 'web-server-status-alarm', {
    //   metric: new cw.Metric({
    //     metricName: "StatusCheckFailed_System",
    //     namespace: "EC2",
    //     period: cdk.Duration.minutes(1),

    //   })
    // })
  }
}
