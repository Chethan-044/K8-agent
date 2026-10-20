
pipeline {
    agent any

    parameters {
        string(
            name: 'DOCKERHUB_USERNAME',
            defaultValue: '',
            description: 'Enter your Docker Hub username'
        )
    }

    environment {
        BACKEND_IMAGE  = "${params.DOCKERHUB_USERNAME}/k8s-agent-backend"
        FRONTEND_IMAGE = "${params.DOCKERHUB_USERNAME}/k8s-agent-frontend"
        IMAGE_TAG      = "${BUILD_NUMBER}"
    }

    stages {
        stage('Validate Parameters') {
            steps {
                script {
                    if (!params.DOCKERHUB_USERNAME?.trim()) {
                        error('Docker Hub username is required.')
                    }
                }
            }
        }

        stage('Checkout Source') {
            steps {
                checkout scm
            }
        }

        stage('Build Docker Images') {
            parallel {
                stage('Build Backend') {
                    steps {
                        dir('backend') {
                            sh '''
                                docker build \
                                  -t "$BACKEND_IMAGE:$IMAGE_TAG" .
                            '''
                        }
                    }
                }

                stage('Build Frontend') {
                    steps {
                        dir('frontend') {
                            sh '''
                                docker build \
                                  -t "$FRONTEND_IMAGE:$IMAGE_TAG" .
                            '''
                        }
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
                        echo "$DH_TOKEN" | docker login \
                          --username "$DH_USER" \
                          --password-stdin
                    '''
                }
            }
        }

        stage('Push Images to Docker Hub') {
            steps {
                sh '''
                    docker push "$BACKEND_IMAGE:$IMAGE_TAG"
                    docker push "$FRONTEND_IMAGE:$IMAGE_TAG"
                '''
            }
        }

        stage('Update Kubernetes Image Tags') {
            steps {
                sh '''
                    set -eu

                    test -f k8/deployment.yaml

                    sed -i -E \
                      "s|image: *[^[:space:]]*k8s-agent-backend:[^[:space:]]*|image: ${BACKEND_IMAGE}:${IMAGE_TAG}|" \
                      k8/deployment.yaml

                    sed -i -E \
                      "s|image: *[^[:space:]]*k8s-agent-frontend:[^[:space:]]*|image: ${FRONTEND_IMAGE}:${IMAGE_TAG}|" \
                      k8/deployment.yaml

                    grep -n 'image:' k8s/base/deployment.yaml
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
                        set +x

                        git config user.name "Jenkins"
                        git config user.email "jenkins@example.com"

                        git add k8/deployment.yaml

                        if git diff --cached --quiet; then
                            echo "No manifest changes to commit."
                            exit 0
                        fi

                        git commit -m "Update K8-Agent images to build ${IMAGE_TAG}"

                        REPO_URL=$(git config --get remote.origin.url)
                        REPO_PATH=${REPO_URL#https://github.com/}
                        REPO_PATH=${REPO_PATH#http://github.com/}
                        REPO_PATH=${REPO_PATH%.git}

                        git remote set-url origin \
                          "https://${GIT_USER}:${GIT_TOKEN}@github.com/${REPO_PATH}.git"

                        git push origin HEAD
                    '''
                }
            }
        }
    }

    post {
        success {
            echo "Build #${IMAGE_TAG}: images pushed and Kubernetes manifests updated in Git."
            echo "Argo CD can now sync the new image tags."
        }

        failure {
            echo 'Pipeline failed. Check the stage logs.'
        }

        always {
            sh '''
                docker rmi "$BACKEND_IMAGE:$IMAGE_TAG" || true
                docker rmi "$FRONTEND_IMAGE:$IMAGE_TAG" || true
                docker logout || true
            '''
        }
    }
}
