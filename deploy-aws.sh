#!/bin/bash
# AWS Deployment Script for Novita Telemedicina
# Target: novita.migrai.com.br

set -e

echo "🚀 Iniciando deploy para AWS..."
echo "📍 Domínio: novita.migrai.com.br"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
BUCKET_NAME="novita.migrai.com.br"
REGION="us-east-1"
DIST_FOLDER="dist"
POLICY_FILE="./.deploy-s3-policy.json"
CLOUDFRONT_CONFIG_FILE="./.deploy-cloudfront-config.json"

cleanup() {
    rm -f "$POLICY_FILE"
}
trap cleanup EXIT

echo -e "${YELLOW}Step 1: Verificando build...${NC}"
if [ ! -d "$DIST_FOLDER" ]; then
    echo -e "${RED}❌ Pasta dist não encontrada. Execute 'npm run build' primeiro.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Build encontrado${NC}"

echo ""
echo -e "${YELLOW}Step 2: Criando bucket S3...${NC}"
aws s3 mb s3://$BUCKET_NAME --region $REGION || echo "Bucket já existe"
echo -e "${GREEN}✓ Bucket S3 pronto${NC}"

echo ""
echo -e "${YELLOW}Step 3: Configurando bucket para static hosting...${NC}"
aws s3 website s3://$BUCKET_NAME \
    --index-document index.html \
    --error-document index.html
echo -e "${GREEN}✓ Static website configurado${NC}"

echo ""
echo -e "${YELLOW}Step 4: Aplicando policy de acesso público...${NC}"
cat > "$POLICY_FILE" << 'EOF'
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "PublicReadGetObject",
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::novita.migrai.com.br/*"
        }
    ]
}
EOF
aws s3api put-bucket-policy --bucket $BUCKET_NAME --policy file://$POLICY_FILE
echo -e "${GREEN}✓ Policy aplicada${NC}"

echo ""
echo -e "${YELLOW}Step 5: Fazendo upload dos arquivos...${NC}"
aws s3 sync $DIST_FOLDER/ s3://$BUCKET_NAME \
    --delete \
    --cache-control "max-age=31536000,immutable" \
    --exclude "index.html"

# Upload index.html com cache menor
aws s3 cp $DIST_FOLDER/index.html s3://$BUCKET_NAME/index.html \
    --cache-control "max-age=0,no-cache,no-store,must-revalidate"
echo -e "${GREEN}✓ Arquivos enviados${NC}"

echo ""
echo -e "${YELLOW}Step 6: Configurando CloudFront...${NC}"
echo "Criando distribuição CloudFront..."

# Criar distribuição CloudFront
cat > "$CLOUDFRONT_CONFIG_FILE" << EOF
{
    "CallerReference": "$(date +%s)",
    "Origins": {
        "Quantity": 1,
        "Items": [
            {
                "Id": "S3-novita-migrai",
                "DomainName": "$BUCKET_NAME.s3.amazonaws.com",
                "S3OriginConfig": {
                    "OriginAccessIdentity": ""
                }
            }
        ]
    },
    "DefaultCacheBehavior": {
        "TargetOriginId": "S3-novita-migrai",
        "ViewerProtocolPolicy": "redirect-to-https",
        "AllowedMethods": {
            "Quantity": 2,
            "Items": ["GET", "HEAD"],
            "CachedMethods": {
                "Quantity": 2,
                "Items": ["GET", "HEAD"]
            }
        },
        "ForwardedValues": {
            "QueryString": false,
            "Cookies": {"Forward": "none"}
        },
        "MinTTL": 0,
        "DefaultTTL": 86400,
        "MaxTTL": 31536000,
        "Compress": true
    },
    "Comment": "Novita Telemedicina - Static Website",
    "Enabled": true,
    "DefaultRootObject": "index.html",
    "CustomErrorResponses": {
        "Quantity": 1,
        "Items": [
            {
                "ErrorCode": 404,
                "ResponsePagePath": "/index.html",
                "ResponseCode": "200",
                "ErrorCachingMinTTL": 300
            }
        ]
    },
    "Aliases": {
        "Quantity": 1,
        "Items": ["novita.migrai.com.br"]
    }
}
EOF

echo -e "${GREEN}✓ Configuração CloudFront criada${NC}"
echo -e "${YELLOW}Para criar a distribuição, execute:${NC}"
echo "aws cloudfront create-distribution --distribution-config file://$CLOUDFRONT_CONFIG_FILE"

echo ""
echo -e "${GREEN}🎉 Deploy para S3 concluído!${NC}"
echo ""
echo "📊 Informações:"
echo "  - Bucket: s3://$BUCKET_NAME"
echo "  - Website: http://$BUCKET_NAME.s3-website-$REGION.amazonaws.com"
echo ""
echo "🔧 Próximos passos:"
echo "  1. Criar distribuição CloudFront (comando acima)"
echo "  2. Configurar DNS para apontar para o CloudFront"
echo "  3. Configurar SSL/HTTPS no CloudFront"
echo ""
