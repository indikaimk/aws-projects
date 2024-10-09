import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as r53 from 'aws-cdk-lib/aws-route53';

// import * as sqs from 'aws-cdk-lib/aws-sqs';

export class SimpleWebAppStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const vpc = new ec2.Vpc(this, 'simple-webapp-vpc', {
      natGateways: 0,
      ipAddresses: ec2.IpAddresses.cidr('172.30.0.0/16'),
      ipProtocol: ec2.IpProtocol.DUAL_STACK,
    });

    const sshKey = new ec2.KeyPair(this, "simple-webapp-ssh-key", {
      keyPairName: "ssh-key",
    });

    // Prefix S3 bucket with your orgname for uniqueness.
    const webappBucket = new s3.Bucket(this, "cloudqubes-webapp-bucket", {
      removalPolicy: cdk.RemovalPolicy.DESTROY // Set to retain for a production app
    })

    const webServerRole = new iam.Role(this, 'web-sever-role', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com')
    });

    webServerRole.addToPolicy(new iam.PolicyStatement({
      resources: ["arn:aws:s3:::cloudqubes-webapp-bucket", "arn:aws:s3:::cloudqubes-webapp-bucket/*"],
      actions: ["s3:*", "s3-object-lambda:*"]
    }))

    const dataVolume = ec2.BlockDeviceVolume.ebs(20, {
      volumeType: ec2.EbsDeviceVolumeType.GP3,
      // Uncomment below for a production app
      // deleteOnTermination: false 
    })

    const webServer = new ec2.Instance(this, 'liyum-web', {
      vpc: vpc,
      // instance type - t4g.micro
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.MICRO),
      machineImage: ec2.MachineImage.genericLinux({"us-east-2": "ami-03bfe38a90ce33425"}),
      keyPair: sshKey,
      role: webServerRole,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PUBLIC
      },
      blockDevices: [
        {
          deviceName: "/dev/sda1",
          volume: ec2.BlockDeviceVolume.ebs(8, {
            volumeType: ec2.EbsDeviceVolumeType.GP3,
            // Uncomment below for a production app
            // deleteOnTermination: false
          })
        },
        {
          deviceName: "/dev/sdb",
          volume: dataVolume
        }
      ],
      // userData: liyumUserData
    });

    const cloudqubesZone = new r53.HostedZone(this, "cloudqubes", {
      zoneName: "dev.cloudqubes.com"
    })

    const eIP = new ec2.CfnEIP(this, "web-server-ip", {
      instanceId: webServer.instanceId
    });

    const r = new r53.ARecord(this, "cloudqubes-a-record", {
      zone: cloudqubesZone,
      target: r53.RecordTarget.fromIpAddresses(eIP.attrPublicIp)
    })

    webServer.connections.allowFromAnyIpv4(ec2.Port.HTTPS)
    webServer.connections.allowFromAnyIpv4(ec2.Port.HTTP)
    webServer.connections.allowFrom(ec2.Peer.anyIpv6(), ec2.Port.HTTPS)
    webServer.connections.allowFrom(ec2.Peer.ipv4("175.157.0.0/16"), ec2.Port.SSH)



  }
}
