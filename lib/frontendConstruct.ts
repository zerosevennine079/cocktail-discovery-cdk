import { Construct } from "constructs";
import { Bucket } from 'aws-cdk-lib/aws-s3';
import {
    AllowedMethods,
    CachePolicy,
    Distribution,
    OriginAccessIdentity,
    OriginProtocolPolicy, OriginRequestPolicy,
    ViewerProtocolPolicy
} from "aws-cdk-lib/aws-cloudfront";
import * as cdk from "aws-cdk-lib";
import {CanonicalUserPrincipal, PolicyStatement} from "aws-cdk-lib/aws-iam";
import {HttpOrigin, S3Origin} from "aws-cdk-lib/aws-cloudfront-origins";
import {BucketDeployment, Source} from "aws-cdk-lib/aws-s3-deployment";
import * as path from 'path';


export class FrontendConstruct extends Construct {
    public bucket: Bucket;
    public distribution: Distribution;

    constructor(scope: Construct, id: string, apiOriginName: string) {
        super(scope, id);

        /*
            The bucket to host the React app
        */
        this.bucket = new Bucket(this, 'ReactAppBucket', {
            versioned: true,
            publicReadAccess: true,
            blockPublicAccess: {
                blockPublicAcls: false,
                blockPublicPolicy: false,
                ignorePublicAcls: false,
                restrictPublicBuckets: false,
            },
            websiteIndexDocument: 'index.html',
            websiteErrorDocument: 'index.html',
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });

        /*
          Cloudfront Origin Access identity.  This allows the cloudfront distribution (below)
          to read the S3 bucket where the website assets are hosted.
         */
        const cloudFrontOAI = new OriginAccessIdentity(this, 'CloudFrontOAI');
        this.bucket.grantRead(cloudFrontOAI);
        this.bucket.addToResourcePolicy(new PolicyStatement({
            actions: ['s3:GetObject'],
            resources: [this.bucket.arnForObjects('*')],
            principals: [new CanonicalUserPrincipal(cloudFrontOAI.cloudFrontOriginAccessIdentityS3CanonicalUserId)],
        }));

        this.distribution = new Distribution(this, "ReactAppDistribution", {
                defaultBehavior: {
                    origin: new S3Origin(this.bucket, { originAccessIdentity: cloudFrontOAI })
                },
                defaultRootObject: "/index.html",
                errorResponses: [
                    {
                        httpStatus: 403,
                        responseHttpStatus: 200,
                        responsePagePath: '/index.html',
                        ttl: cdk.Duration.minutes(5),
                    },
                    {
                        httpStatus: 404,
                        responseHttpStatus: 200,
                        responsePagePath: '/index.html',
                        ttl: cdk.Duration.minutes(5),
                    },
                ],
                additionalBehaviors: {
                    "/api/*": {
                        origin: new HttpOrigin(apiOriginName, {
                            originId: apiOriginName,
                            protocolPolicy: OriginProtocolPolicy.HTTPS_ONLY,
                        }),
                        viewerProtocolPolicy: ViewerProtocolPolicy.HTTPS_ONLY,
                        cachePolicy: CachePolicy.CACHING_DISABLED,
                        allowedMethods: AllowedMethods.ALLOW_ALL,
                        originRequestPolicy: OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
                    },
                },
            }
        );

        /*
          Deploy the assets from the React build to S3.
         */
        new BucketDeployment(this, 'DeployReactApp', {
            sources: [Source.asset(path.join(__dirname, '..', '..', 'cocktail-discovery-app', 'build'))],
            destinationBucket: this.bucket,
            distribution: this.distribution,
            distributionPaths: ['/*', '/static/*', '/static/css/*', '/static/js/*', '/static/media/*'],
        });
    }
}