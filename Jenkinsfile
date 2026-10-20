
pipeline {
    agent any

    parameters {
        string(
            name: 'DOCKERHUB_USERNAME',
            defaultValue: 'chtnnn',
            description: 'Docker Hub username'
        )
    }

    environment {
        BACKEND_IMAGE  = "${params.DOCKERHUB_USERNAME}/k8s-agent-backend"
        FRONTEND_IMAGE = "${params.DOCKERHUB_USERNAME}/k8s-agent-frontend"
        IMAGE_TAG      = "${BUILD_NUMBER}"
        MANIFEST_FILE  = "k8s/base/deployment.yaml"
    }

    stages {
        stage('Checkout Source') {
            steps {
                checkout scm
            }
        }

        stage('Validate') {
            steps {
                sh '''
                    set -eu
                    test -d backend
                    test -d frontend
                    test -f "$MANIFEST_FILE"
                    test -f backend/Dockerfile
                    test -f frontend/Dockerfile
                '''
            }
        }

        stage('Build Docker Images') {
            parallel {
                stage('Build Backend') {
                    steps {
                        sh '''
                            docker build \
                              -t "$BACKEND_IMAGE:$IMAGE_TAG" \
                              ./backend
                        '''
                    }
                }

                stage('Build Frontend') {
                    steps {
                        sh '''
                            docker build \
                              -t "$FRONTEND_IMAGE:$IMAGE_TAG" \
                              ./frontend
                        '''
                    }
                }
            }
        }

        stage('Login to Docker Hub') {
            steps {
                withCredentials([
                    usernamePassword(
                        credentialsId: 'dockerhub-credentials',
                        usernameVariable: 'DH_USER',
                        passwordVariable: 'DH_TOKEN'
                    )
                ]) {
                    sh '''
                        set +x
                        printf '%s' "$DH_TOKEN" |
                            docker login -u "$DH_USER" --password-stdin
                    '''
                }
            }
        }

        stage('Push Images to Docker Hub') {
            steps {
                sh '''
                    set -eu
                    docker push "$BACKEND_IMAGE:$IMAGE_TAG"
                    docker push "$FRONTEND_IMAGE:$IMAGE_TAG"
                '''
            }
        }

        stage('Update Kubernetes Image Tags') {
            steps {
                sh '''
                    set -eu

                    test -f "$MANIFEST_FILE"

                    sed -i -E \
                      's|image: *k8s-agent/backend(:[^[:space:]]*)?$|image: '"$BACKEND_IMAGE:$IMAGE_TAG"'|' \
                      "$MANIFEST_FILE"

                    sed -i -E \
                      's|image: *k8s-agent/frontend(:[^[:space:]]*)?$|image: '"$FRONTEND_IMAGE:$IMAGE_TAG"'|' \
                      "$MANIFEST_FILE"

                    echo "Updated images:"
                    grep -n 'image:' "$MANIFEST_FILE"

                    grep -Fq "image: $BACKEND_IMAGE:$IMAGE_TAG" "$MANIFEST_FILE"
                    grep -Fq "image: $FRONTEND_IMAGE:$IMAGE_TAG" "$MANIFEST_FILE"
                '''
            }
        }

        stage('Commit and Push Manifest Changes') {
            steps {
                withCredentials([
                    usernamePassword(
                        credentialsId: 'github-write-credentials',
                        usernameVariable: 'GIT_USER',
                        passwordVariable: 'GIT_TOKEN'
                    )
                ]) {
                    sh '''
                        set -eu

                        git config user.name "Jenkins"
                        git config user.email "jenkins@example.com"

                        git add "$MANIFEST_FILE"

                        if git diff --cached --quiet; then
                            echo "No manifest changes to commit."
                            exit 0
                        fi

                        git commit -m "ci: update K8-Agent images to build $IMAGE_TAG"

                        REPO_PATH="Chethan-044/K8-agent"
                        BRANCH="main"

                        git remote set-url origin \
                          "https://${GIT_USER}:${GIT_TOKEN}@github.com/${REPO_PATH}.git"

                        git push origin "HEAD:${BRANCH}"
                    '''
                }
            }
        }
    }

    post {
        success {
            echo 'Pipeline succeeded. Argo CD can now sync the updated manifests.'
        }

        failure {
            echo 'Pipeline failed. Check the stage logs.'
        }

        always {
            sh '''
                docker logout >/dev/null 2>&1 || true
                docker rmi "$BACKEND_IMAGE:$IMAGE_TAG" >/dev/null 2>&1 || true
                docker rmi "$FRONTEND_IMAGE:$IMAGE_TAG" >/dev/null 2>&1 || true
            '''
        }
    }
}
